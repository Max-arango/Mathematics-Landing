import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

/**
 * Secure session management.
 *
 * - The cookie holds an opaque 256-bit token (CSPRNG, base64url).
 * - The database stores ONLY sha256(token) → a stolen DB cannot be replayed.
 * - Cookie flags: HttpOnly (no JS access), SameSite=Lax (CSRF mitigation),
 *   Secure whenever the request arrived over HTTPS, Path=/, explicit expiry.
 * - Fixed 7-day lifetime; `lastSeenAt` is refreshed at most hourly for audit.
 */

export const SESSION_COOKIE = "ms_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000; // 1 hour throttle

export type Role = "USER" | "ADMIN";

export const PERMISSION_KEYS = [
  "users:read",
  "users:write",
  "sessions:revoke",
  "audit:read",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  permissions: string[];
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface UserWithRelations {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  permissions: { key: string }[];
}

export function toSafeUser(user: UserWithRelations): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "ADMIN" : "USER",
    isActive: user.isActive,
    permissions: user.permissions.map((p) => p.key),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function sha256Token(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** True when the original request arrived over HTTPS (behind proxy or direct). */
export function requestIsSecure(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  const url = new URL(req.url);
  return url.protocol === "https:";
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Create a DB-backed session and return the opaque token for the cookie. */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256Token(token),
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ? meta.userAgent.slice(0, 256) : null,
    },
  });
  return { token, expiresAt };
}

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  expires: Date;
}

export function buildSessionCookie(token: string, expiresAt: Date, secure: boolean): SessionCookieOptions {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: expiresAt,
  };
}

export function buildClearedCookie(secure: boolean): SessionCookieOptions {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(0),
  };
}

/** Write the session cookie inside a Route Handler. */
export async function setSessionCookie(token: string, expiresAt: Date, secure: boolean): Promise<void> {
  const store = await cookies();
  store.set(buildSessionCookie(token, expiresAt, secure));
}

/** Clear the session cookie inside a Route Handler. */
export async function clearSessionCookie(secure: boolean): Promise<void> {
  const store = await cookies();
  store.set(buildClearedCookie(secure));
}

/**
 * Resolve the current session from the request cookies into a SafeUser.
 * Returns null for missing/expired sessions and deactivated users.
 * Expired sessions are deleted lazily; lastSeenAt is throttled.
 */
export async function getSessionUser(): Promise<SafeUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256Token(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { permissions: { select: { key: true } } } } },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.user.isActive) return null;

  const sinceLastSeen = Date.now() - session.lastSeenAt.getTime();
  if (sinceLastSeen > LAST_SEEN_REFRESH_MS) {
    await db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return toSafeUser(session.user);
}

/** Destroy the session carried by the current request cookies (if any). */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await db.session
    .delete({ where: { tokenHash: sha256Token(token) } })
    .catch(() => undefined);
}

/** Revoke every session belonging to a user (e.g. after deactivation/password reset). */
export async function destroyUserSessions(userId: string, exceptTokenHash?: string): Promise<number> {
  const res = await db.session.deleteMany({
    where: {
      userId,
      ...(exceptTokenHash ? { tokenHash: { not: exceptTokenHash } } : {}),
    },
  });
  return res.count;
}

/** Remove expired sessions from the DB (call opportunistically from routes). */
export async function pruneExpiredSessions(): Promise<void> {
  await db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }).catch(() => undefined);
}
