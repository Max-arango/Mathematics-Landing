import {
  clearSessionCookie,
  destroyCurrentSession,
  requestIsSecure,
} from "@/lib/auth/session";
import { handleApiError } from "@/lib/auth/api";

export const runtime = "nodejs";

/** POST /api/auth/logout — destroys the DB session and clears the cookie. */
export async function POST(req: Request) {
  try {
    await destroyCurrentSession();
    await clearSessionCookie(requestIsSecure(req));
    return Response.json({ ok: true }, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
