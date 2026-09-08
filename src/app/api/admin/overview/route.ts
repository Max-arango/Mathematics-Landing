import { db } from "@/lib/db";
import { requireAdmin, handleApiError } from "@/lib/auth/api";
import { pruneExpiredSessions } from "@/lib/auth/session";
import { mapLoginAttempt } from "@/lib/auth/serialize";

export const runtime = "nodejs";

/**
 * GET /api/admin/overview — dashboard counters + 10 most recent attempts.
 * ADMIN ONLY (requireAdmin throws 401/403 otherwise).
 */
export async function GET() {
  try {
    await requireAdmin();
    await pruneExpiredSessions();

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      activeSessions,
      failedAttempts24h,
      totalAttempts24h,
      recentAttempts,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.user.count({ where: { role: "ADMIN" } }),
      db.session.count({ where: { expiresAt: { gt: now } } }),
      db.loginAttempt.count({ where: { success: false, createdAt: { gte: since24h } } }),
      db.loginAttempt.count({ where: { createdAt: { gte: since24h } } }),
      db.loginAttempt.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

    return Response.json(
      {
        stats: {
          totalUsers,
          activeUsers,
          adminUsers,
          activeSessions,
          failedAttempts24h,
          totalAttempts24h,
        },
        recentAttempts: recentAttempts.map(mapLoginAttempt),
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
