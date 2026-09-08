import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { ApiError, handleApiError, normalizeEmail, readJson, requireAdmin } from "@/lib/auth/api";
import { mapAdminUser } from "@/lib/auth/serialize";

export const runtime = "nodejs";

const activeSessionsFilter = (now: Date) => ({
  where: { expiresAt: { gt: now } },
  select: { id: true },
});

const includeForMap = {
  permissions: { select: { key: true } },
  emails: { orderBy: [{ isPrimary: "desc" as const }, { address: "asc" as const }] },
};

/**
 * GET /api/admin/users — list every user with emails, permissions and
 * active session count. ADMIN ONLY.
 */
export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { ...includeForMap, sessions: activeSessionsFilter(now) },
    });
    return Response.json(
      { users: users.map(mapAdminUser) },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, { message: "Introduce un correo electrónico." })
    .max(255, { message: "El correo es demasiado largo." })
    .email({ message: "Correo electrónico inválido." }),
  name: z
    .string()
    .trim()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
    .max(80, { message: "El nombre no puede superar los 80 caracteres." })
    .optional(),
  password: z.string().min(1, { message: "Introduce una contraseña." }).max(128),
  role: z.enum(["USER", "ADMIN"], { message: "Rol inválido." }),
});

/**
 * POST /api/admin/users — create a user with a chosen role.
 * The password is hashed with Argon2id + a fresh unique salt server-side.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const parsed = createUserSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    const email = normalizeEmail(parsed.data.email);
    const policyError = validatePassword(parsed.data.password);
    if (policyError) throw new ApiError(400, policyError);

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ApiError(409, "Este correo ya está registrado.");

    const { hash, salt } = await hashPassword(parsed.data.password);
    const user = await db.user.create({
      data: {
        email,
        name: parsed.data.name ?? null,
        role: parsed.data.role,
        password: { create: { hash, salt } },
        emails: {
          create: { address: email, isPrimary: true, isVerified: true },
        },
      },
      include: { ...includeForMap, sessions: { select: { id: true } } },
    });

    return Response.json(
      { user: mapAdminUser(user) },
      { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return handleApiError(new ApiError(409, "Este correo ya está registrado."));
    }
    return handleApiError(err);
  }
}
