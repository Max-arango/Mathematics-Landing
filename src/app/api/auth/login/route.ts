import { z } from "zod";
import { db } from "@/lib/db";
import { dummyVerify, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  requestIsSecure,
  setSessionCookie,
  toSafeUser,
} from "@/lib/auth/session";
import {
  ApiError,
  auditLoginAttempt,
  getClientIp,
  getUserAgent,
  handleApiError,
  normalizeEmail,
  readJson,
} from "@/lib/auth/api";
import {
  getLoginRateState,
  recordLoginAttempt,
} from "@/lib/auth/rate-limit";

export const runtime = "nodejs"; // Argon2 native module requires Node runtime

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, { message: "Introduce un correo electrónico." })
    .max(255, { message: "El correo es demasiado largo." }),
  password: z
    .string()
    .min(1, { message: "Introduce tu contraseña." })
    .max(128, { message: "La contraseña es demasiado larga." }),
});

/**
 * POST /api/auth/login
 *
 * Security layers, in order:
 *  1. Rate limiting  — 5 failed attempts per (IP + email) → 15 min lockout;
 *     30 attempts per IP per 15 min (brute-force / spray protection).
 *  2. Timing equalization — unknown emails still verify against a dummy
 *     Argon2id hash so latency cannot enumerate accounts.
 *  3. Argon2id constant-time verification against the stored PHC string.
 *  4. Auditing — every attempt is persisted (never the password itself).
 *  5. Session — opaque 256-bit token in an HttpOnly + SameSite=Lax (+Secure
 *     on HTTPS) cookie; the DB only stores its SHA-256 hash.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const parsed = loginSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;

    // 1) Rate limiting.
    const state = getLoginRateState(ip, email);
    if (!state.allowed) {
      await auditLoginAttempt({
        email,
        ip,
        userAgent,
        success: false,
        reason: "rate_limited",
      });
      const cause =
        state.reason === "ip_limited"
          ? "Demasiados intentos desde tu dirección. Espera e inténtalo de nuevo."
          : "Cuenta bloqueada temporalmente por intentos fallidos. Espera e inténtalo de nuevo.";
      throw new ApiError(429, cause, { retryAfterSeconds: state.retryAfterSeconds });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        password: true,
        permissions: { select: { key: true } },
      },
    });

    // 2) Unknown account → burn equal CPU, identical generic error.
    if (!user || !user.password) {
      await dummyVerify();
      recordLoginAttempt(ip, email, false);
      await auditLoginAttempt({
        email,
        ip,
        userAgent,
        success: false,
        reason: "unknown_email",
      });
      throw new ApiError(401, "Credenciales inválidas.");
    }

    if (!user.isActive) {
      recordLoginAttempt(ip, email, false);
      await auditLoginAttempt({
        email,
        userId: user.id,
        ip,
        userAgent,
        success: false,
        reason: "inactive",
      });
      throw new ApiError(403, "Esta cuenta está desactivada. Contacta al administrador.");
    }

    // 3) Argon2id verification.
    const valid = await verifyPassword(user.password.hash, password);
    if (!valid) {
      recordLoginAttempt(ip, email, false);
      await auditLoginAttempt({
        email,
        userId: user.id,
        ip,
        userAgent,
        success: false,
        reason: "bad_password",
      });
      const postState = getLoginRateState(ip, email);
      throw new ApiError(
        401,
        postState.allowed
          ? "Credenciales inválidas."
          : "Credenciales inválidas. La cuenta quedó bloqueada temporalmente.",
        postState.allowed ? undefined : { retryAfterSeconds: postState.retryAfterSeconds },
      );
    }

    // Success → clear failure history, audit, session.
    recordLoginAttempt(ip, email, true);
    await auditLoginAttempt({
      email,
      userId: user.id,
      ip,
      userAgent,
      success: true,
      reason: "ok",
    });

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { token, expiresAt } = await createSession(user.id, {
      ip,
      userAgent,
    });
    await setSessionCookie(token, expiresAt, requestIsSecure(req));

    return Response.json({ user: toSafeUser(user) }, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
