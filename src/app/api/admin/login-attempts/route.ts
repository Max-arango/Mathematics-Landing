import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handleApiError, requireAdmin } from "@/lib/auth/api";
import { mapLoginAttempt } from "@/lib/auth/serialize";

export const runtime = "nodejs";

/**
 * GET /api/admin/login-attempts?limit=50 — audit trail of every login
 * attempt (successes and failures). ADMIN ONLY.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const parsedLimit = Number.parseInt(limitRaw ?? "50", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 200)
      : 50;

    const attempts = await db.loginAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return Response.json(
      { attempts: attempts.map(mapLoginAttempt) },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
