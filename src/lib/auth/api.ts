import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import {
  getSessionUser,
  type Role,
  type SafeUser,
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/auth/session";

/**
 * Shared helpers for Route Handlers: uniform JSON responses (no-store),
 * client metadata extraction, auth guards and centralized error mapping.
 */

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonError(error: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

export class ApiError extends Error {
  readonly status: number;
  readonly extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function getUserAgent(req: Request): string | null {
  const ua = req.headers.get("user-agent");
  return ua ? ua.slice(0, 256) : null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ADMIN implicitly holds every permission; other roles check explicit grants. */
export function hasPermission(user: SafeUser, key: PermissionKey): boolean {
  if (user.role === "ADMIN") return true;
  return user.permissions.includes(key);
}

/** Guard: any authenticated, active user. Throws ApiError(401) otherwise. */
export async function requireUser(): Promise<SafeUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Necesitas iniciar sesión para realizar esta acción.");
  return user;
}

/** Guard: role === ADMIN only. This is what protects every /api/admin route. */
export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new ApiError(403, "Acceso restringido al administrador.");
  }
  return user;
}

/** Guard: authenticated AND holds a specific permission (admins always pass). */
export async function requirePermission(key: PermissionKey): Promise<SafeUser> {
  const user = await requireUser();
  if (!hasPermission(user, key)) {
    throw new ApiError(403, "No tienes permisos para realizar esta acción.");
  }
  return user;
}

/** Audit one login attempt into LoginAttempt (never stores passwords). */
export async function auditLoginAttempt(entry: {
  email: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  reason?: string | null;
}): Promise<void> {
  try {
    await db.loginAttempt.create({
      data: {
        email: entry.email.slice(0, 255),
        userId: entry.userId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ? entry.userAgent.slice(0, 256) : null,
        success: entry.success,
        reason: entry.reason ?? null,
      },
    });
  } catch (err) {
    // Auditing must never break the auth flow.
    console.error("[audit] failed to record login attempt", err);
  }
}

export function isValidRole(role: string): role is Role {
  return role === "USER" || role === "ADMIN";
}

export function isValidPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(key);
}

/** Map thrown errors to uniform JSON responses; unknown errors → opaque 500. */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return jsonError(err.message, err.status, err.extra);
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const message = first?.message ?? "Datos inválidos.";
    return jsonError(message, 400);
  }
  console.error("[api] unhandled error", err);
  return jsonError("Error interno del servidor.", 500);
}

/** Parse a JSON body defensively; returns null on malformed input. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
