import { getSessionUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/auth/api";

export const runtime = "nodejs";

/** GET /api/auth/me — returns the current session user (or null). */
export async function GET() {
  try {
    const user = await getSessionUser();
    return Response.json({ user }, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
