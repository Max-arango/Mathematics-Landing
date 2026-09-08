import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import {
  createSession,
  requestIsSecure,
  setSessionCookie,
  toSafeUser,
} from "@/lib/auth/session";
import {
  ApiError,
  getClientIp,
  getUserAgent,
  handleApiError,
  normalizeEmail,
  readJson,
} from "@/lib/auth/api";
import { genericRateLimit } from "@/lib/auth/rate-limit";

export const runtime = "nodejs"; // Argon2 native module requires Node runtime

const registerSchema = z.object({
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
});

/**
 * POST /api/auth/register — open self-registration (role USER).
 * Hardened: per-IP registration throttle (5/hour), password policy,
 * Argon2id + unique salt, and an immediate authenticated session.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = genericRateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      throw new ApiError(
        429,
        "Demasiados registros desde esta dirección. Inténtalo más tarde.",
        { retryAfterSeconds: rl.retryAfterSeconds },
      );
    }

    const parsed = registerSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    const email = normalizeEmail(parsed.data.email);
    const password = parsed.data.password;

    const policyError = validatePassword(password);
    if (policyError) throw new ApiError(400, policyError);

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) throw new ApiError(409, "Este correo ya está registrado.");

    const { hash, salt } = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        name: parsed.data.name ?? null,
        role: "USER",
        password: { create: { hash, salt } },
        emails: {
          create: { address: email, isPrimary: true, isVerified: false },
        },
      },
      include: { permissions: { select: { key: true } } },
    });

    const { token, expiresAt } = await createSession(user.id, {
      ip,
      userAgent: getUserAgent(req),
    });
    await setSessionCookie(token, expiresAt, requestIsSecure(req));

    return Response.json({ user: toSafeUser(user) }, {
      status: 201,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return handleApiError(new ApiError(409, "Este correo ya está registrado."));
    }
    return handleApiError(err);
  }
}
