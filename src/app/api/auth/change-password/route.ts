import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  destroyUserSessions,
  sha256Token,
} from "@/lib/auth/session";
import { ApiError, handleApiError, readJson, requireUser } from "@/lib/auth/api";

export const runtime = "nodejs";

const changeSchema = z.object({
  currentPassword: z
    .string()
    .min(1, { message: "Introduce tu contraseña actual." })
    .max(128),
  newPassword: z
    .string()
    .min(1, { message: "Introduce la nueva contraseña." })
    .max(128),
});

/**
 * POST /api/auth/change-password
 * Verifies the current password, re-hashes with a NEW unique Argon2id salt,
 * and revokes every other session (defence against hijacked sessions).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const parsed = changeSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    const policyError = validatePassword(parsed.data.newPassword);
    if (policyError) throw new ApiError(400, policyError);

    const credential = await db.passwordCredential.findUnique({
      where: { userId: user.id },
    });
    if (!credential) {
      throw new ApiError(400, "Esta cuenta no tiene contraseña configurada.");
    }

    const valid = await verifyPassword(credential.hash, parsed.data.currentPassword);
    if (!valid) {
      throw new ApiError(400, "La contraseña actual no es válida.");
    }

    const { hash, salt } = await hashPassword(parsed.data.newPassword);
    await db.passwordCredential.update({
      where: { userId: user.id },
      data: {
        hash,
        salt,
        lastChangedAt: new Date(),
        params: JSON.stringify({ memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      },
    });

    // Keep the current session alive, kill the rest.
    const currentToken = (await cookies()).get(SESSION_COOKIE)?.value;
    await destroyUserSessions(user.id, currentToken ? sha256Token(currentToken) : undefined);

    return Response.json({ ok: true }, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
