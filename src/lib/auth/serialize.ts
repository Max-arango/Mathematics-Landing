import type { EmailAddress, LoginAttempt, Permission, Session, User } from "@prisma/client";

/**
 * DTO mappers shared by every /api/admin route.
 * Dates are serialized as ISO strings — the contract the admin UI expects.
 */

export interface AdminUserDTO {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  permissions: string[];
  emails: { address: string; isPrimary: boolean; isVerified: boolean }[];
  createdAt: string;
  lastLoginAt: string | null;
  activeSessions: number;
}

export interface LoginAttemptDTO {
  id: string;
  email: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

interface AdminUserInclude {
  permissions: Pick<Permission, "key">[];
  emails: Pick<EmailAddress, "address" | "isPrimary" | "isVerified">[];
  sessions: Pick<Session, "id">[];
}

export function mapAdminUser(
  user: Pick<User, "id" | "email" | "name" | "role" | "isActive" | "createdAt" | "lastLoginAt"> &
    AdminUserInclude,
): AdminUserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "ADMIN" : "USER",
    isActive: user.isActive,
    permissions: user.permissions.map((p) => p.key),
    emails: user.emails.map((e) => ({
      address: e.address,
      isPrimary: e.isPrimary,
      isVerified: e.isVerified,
    })),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    activeSessions: user.sessions.length,
  };
}

export function mapLoginAttempt(attempt: LoginAttempt): LoginAttemptDTO {
  return {
    id: attempt.id,
    email: attempt.email,
    ip: attempt.ip,
    userAgent: attempt.userAgent,
    success: attempt.success,
    reason: attempt.reason,
    createdAt: attempt.createdAt.toISOString(),
  };
}
