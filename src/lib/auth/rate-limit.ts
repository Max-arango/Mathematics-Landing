/**
 * In-memory sliding-window rate limiting for authentication endpoints.
 *
 * Two complementary layers (both local memory — no external middleware):
 *
 * 1. Account layer  — key: `acct:{ip}:{email}`
 *    5 FAILED attempts per (IP, email) pair inside a 15-minute window
 *    triggers a 15-minute lockout for that pair. A successful login clears it.
 *
 * 2. IP layer — key: `ip:{ip}`
 *    Max 30 login attempts (any outcome) per IP inside a 15-minute window.
 *    Blunts distributed-per-account / password-spray brute forcing.
 *
 * Timers are cleaned lazily on access, plus a low-frequency sweep with an
 * unref'd interval so the process can exit normally.
 */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_FAILED_ATTEMPTS_PER_ACCOUNT = 5;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_ATTEMPTS_PER_IP = 30;
export const IP_WINDOW_MS = 15 * 60 * 1000;

interface WindowState {
  hits: number[];
}

/** failed attempts per (ip+email) */
const failureWindows = new Map<string, WindowState>();
/** lockouts per (ip+email) — value = unlock timestamp (epoch ms) */
const accountLocks = new Map<string, number>();
/** all attempts per ip */
const ipWindows = new Map<string, WindowState>();

function pruneHits(state: WindowState | undefined, now: number, windowMs: number): number[] {
  if (!state) return [];
  const cutoff = now - windowMs;
  const fresh = state.hits.filter((t) => t > cutoff);
  return fresh;
}

export interface LoginRateState {
  allowed: boolean;
  /** Seconds until the client may retry (only meaningful when !allowed). */
  retryAfterSeconds: number;
  /** Machine-readable cause: account_locked | ip_limited */
  reason?: "account_locked" | "ip_limited";
  failedAttempts: number;
}

export function getLoginRateState(ip: string, email: string): LoginRateState {
  const now = Date.now();
  const acctKey = `acct:${ip}:${email}`;
  const ipKey = `ip:${ip}`;

  const lockedUntil = accountLocks.get(acctKey) ?? 0;
  if (lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
      reason: "account_locked",
      failedAttempts: MAX_FAILED_ATTEMPTS_PER_ACCOUNT,
    };
  }

  const ipHits = pruneHits(ipWindows.get(ipKey), now, IP_WINDOW_MS);
  if (ipHits.length >= MAX_ATTEMPTS_PER_IP) {
    const oldest = Math.min(...ipHits);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((oldest + IP_WINDOW_MS - now) / 1000),
      reason: "ip_limited",
      failedAttempts: pruneHits(failureWindows.get(acctKey), now, LOGIN_WINDOW_MS).length,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    failedAttempts: pruneHits(failureWindows.get(acctKey), now, LOGIN_WINDOW_MS).length,
  };
}

/** Record the outcome of a login attempt and update windows/lockouts. */
export function recordLoginAttempt(ip: string, email: string, success: boolean): void {
  const now = Date.now();
  const acctKey = `acct:${ip}:${email}`;
  const ipKey = `ip:${ip}`;

  // IP layer: every attempt counts.
  const ipState = ipWindows.get(ipKey) ?? { hits: [] };
  ipState.hits = [...pruneHits(ipState, now, IP_WINDOW_MS), now];
  ipWindows.set(ipKey, ipState);

  if (success) {
    // Successful login forgives the (ip,email) failure history and lockout.
    failureWindows.delete(acctKey);
    accountLocks.delete(acctKey);
    return;
  }

  const failState = failureWindows.get(acctKey) ?? { hits: [] };
  failState.hits = [...pruneHits(failState, now, LOGIN_WINDOW_MS), now];
  failureWindows.set(acctKey, failState);

  if (failState.hits.length >= MAX_FAILED_ATTEMPTS_PER_ACCOUNT) {
    accountLocks.set(acctKey, now + ACCOUNT_LOCK_MS);
    failureWindows.delete(acctKey); // the lock itself governs now
  }
}

/** Remove stale entries so the maps cannot grow unbounded. */
function sweep(): void {
  const now = Date.now();
  for (const [key, until] of accountLocks) {
    if (until <= now) accountLocks.delete(key);
  }
  for (const key of failureWindows.keys()) {
    if (pruneHits(failureWindows.get(key), now, LOGIN_WINDOW_MS).length === 0) {
      failureWindows.delete(key);
    }
  }
  for (const key of ipWindows.keys()) {
    if (pruneHits(ipWindows.get(key), now, IP_WINDOW_MS).length === 0) {
      ipWindows.delete(key);
    }
  }
}

// Low-frequency sweep; unref'd so it never blocks process shutdown.
const sweepInterval = setInterval(sweep, 10 * 60 * 1000);
if (typeof sweepInterval.unref === "function") sweepInterval.unref();

/**
 * Simple sliding-window limiter used for other abuse-sensitive endpoints
 * (e.g. registration). Returns retryAfterSeconds=0 when allowed.
 */
const genericWindows = new Map<string, number[]>();
export function genericRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (genericWindows.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    const oldest = Math.min(...hits);
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  hits.push(now);
  genericWindows.set(key, hits);
  if (genericWindows.size > 10_000) {
    for (const [k, v] of genericWindows) {
      if (v.every((t) => t <= cutoff)) genericWindows.delete(k);
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
