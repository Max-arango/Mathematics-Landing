import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import {
  ApiError,
  handleApiError,
  isValidPermissionKey,
  readJson,
  requireAdmin,
} from "@/lib/auth/api";
import {
  SESSION_COOKIE,
  destroyUserSessions,
  sha256Token,
} from "@/lib/auth/session";
import { mapAdminUser } from "@/lib/auth/serialize";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const activeSessionsFilter = (now: Date) => ({
  where: { expiresAt: { gt: now } },
  select: { id: true },
});

const includeForMap = {
  permissions: { select: { key: true } },
  emails: { orderBy: [{ isPrimary: "desc" as const }, { address: "asc" as const }] },
};

const patchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
    .max(80, { message: "El nombre no puede superar los 80 caracteres." })
    .optional(),
  role: z.enum(["USER", "ADMIN"], { message: "Rol inválido." }).optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string()).max(20).optional(),
  password: z.string().min(1).max(128).optional(),
});

/** Guard: the system must always keep at least one ACTIVE admin. */
async function ensureNotLastAdmin(targetId: string, demoting: boolean, deactivating: boolean) {
  if (!demoting && !deactivating) return;
  const otherActiveAdmins = await db.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: targetId } },
  });
  if (otherActiveAdmins === 0) {
    throw new ApiError(400, "No puedes quitar al último administrador activo del sistema.");
  }
}

/**
 * PATCH /api/admin/users/{id} — edit name, role, isActive, granular
 * permissions and/or reset the password (Argon2id + fresh unique salt).
 * ADMIN ONLY. Password reset and deactivation revoke the user's sessions.
 */
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;

    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "No hay cambios que aplicar.");
    }
    if (data.password) {
      const policyError = validatePassword(data.password);
      if (policyError) throw new ApiError(400, policyError);
    }

    const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new ApiError(404, "Usuario no encontrado.");

    await ensureNotLastAdmin(
      id,
      target.role === "ADMIN" && data.role === "USER",
      data.isActive === false,
    );

    const permissionKeys = data.permissions
      ? Array.from(new Set(data.permissions.filter(isValidPermissionKey)))
      : null;

    await db.$transaction(async (tx) => {
      const userUpdate: { name?: string; role?: "USER" | "ADMIN"; isActive?: boolean } = {};
      if (data.name !== undefined) userUpdate.name = data.name;
      if (data.role !== undefined) userUpdate.role = data.role;
      if (data.isActive !== undefined) userUpdate.isActive = data.isActive;
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id }, data: userUpdate });
      }

      if (permissionKeys) {
        await tx.permission.deleteMany({ where: { userId: id } });
        if (permissionKeys.length > 0) {
          await tx.permission.createMany({
            data: permissionKeys.map((key) => ({ userId: id, key, grantedBy: admin.email })),
          });
        }
      }

      if (data.password !== undefined) {
        const { hash, salt } = await hashPassword(data.password);
        await tx.passwordCredential.upsert({
          where: { userId: id },
          update: { hash, salt, lastChangedAt: new Date() },
          create: { userId: id, hash, salt },
        });
      }
    });

    // Side effects on sessions.
    if (data.isActive === false) {
      // Deactivation: kill every session immediately.
      await destroyUserSessions(id);
    } else if (data.password !== undefined) {
      // Password reset: force re-login everywhere (keep the admin's own
      // session when the admin resets their own password here).
      const currentToken = (await cookies()).get(SESSION_COOKIE)?.value;
      const currentHash = currentToken ? sha256Token(currentToken) : undefined;
      await destroyUserSessions(id, id === admin.id ? currentHash : undefined);
    }

    const now = new Date();
    const fresh = await db.user.findUnique({
      where: { id },
      include: { ...includeForMap, sessions: activeSessionsFilter(now) },
    });
    if (!fresh) throw new ApiError(404, "Usuario no encontrado.");

    return Response.json(
      { user: mapAdminUser(fresh) },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/users/{id} — delete a user. Cascades to password,
 * emails, sessions and permissions; audit attempts are kept (SetNull).
 * Self-deletion and last-admin deletion are blocked.
 */
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;

    if (id === admin.id) {
      throw new ApiError(400, "No puedes eliminar tu propia cuenta.");
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new ApiError(404, "Usuario no encontrado.");

    if (target.role === "ADMIN") {
      const otherActiveAdmins = await db.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        throw new ApiError(400, "No puedes eliminar al último administrador del sistema.");
      }
    }

    await db.user.delete({ where: { id } });
    return Response.json(
      { ok: true },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
