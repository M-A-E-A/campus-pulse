/**
 * In-memory fixed-window rate limiting for auth and RSVP.
 *
 * Honest scope: one process = one map. The app runs as a single `next start`
 * instance (and a single dev server), so this is real protection for the
 * deployment that exists. A horizontally scaled deployment would need a
 * shared store (Redis etc.) — `createRateLimiter` is the seam to swap.
 *
 * KEYING DECISION — login is keyed by EMAIL, not IP: hundreds of students
 * share one campus NAT, so an IP cap would lock the whole school out while
 * a per-account cap locks out exactly the attacker. (Register deliberately
 * has no IP cap for the same NAT reason; it stays guarded by email-taken +
 * zod until email verification exists.)
 *
 * The instances live on globalThis for the same reason the Prisma client
 * does: the credentials provider (route bundle) and the login server action
 * (page bundle) are separate module graphs in Next — without this, each
 * would keep its own counters and a reset in one would not reach the other.
 */

type Bucket = { count: number; resetAt: number };

export type RateLimiter = ReturnType<typeof createRateLimiter>;

/** `now` is injectable so tests run on a fake clock instead of sleeping. */
export function createRateLimiter(now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();

  function live(key: string): Bucket | undefined {
    const b = buckets.get(key);
    if (!b) return undefined;
    if (b.resetAt <= now()) {
      buckets.delete(key);
      return undefined;
    }
    return b;
  }

  return {
    /** Read-only: is this key already at the limit? Never extends a window.
     *  (No windowMs: the bucket already carries its own expiry.) */
    exceeded(key: string, limit: number): boolean {
      return (live(key)?.count ?? 0) >= limit;
    },

    /** Count one attempt. `justLocked` is true on exactly the hit that
     *  crosses the limit — the only moment worth auditing, so a lockout
     *  writes one row instead of one per spammed request. */
    record(key: string, limit: number, windowMs: number): { locked: boolean; justLocked: boolean } {
      const b = live(key) ?? { count: 0, resetAt: now() + windowMs };
      b.count += 1;
      buckets.set(key, b);
      // Sweep when the map grows past a bound: a spammer cycling keys must
      // not grow memory forever.
      if (buckets.size > 1000) {
        const t = now();
        for (const [k, v] of buckets) if (v.resetAt <= t) buckets.delete(k);
      }
      return { locked: b.count >= limit, justLocked: b.count === limit };
    },

    /** A successful login forgives the failures. */
    clear(key: string): void {
      buckets.delete(key);
    },

    /** Test-facing: live bucket count (after expiry sweeps, the map can
     *  still hold unexpired keys). */
    size(): number {
      return buckets.size;
    },
  };
}

/** Normalized login key — both call sites MUST derive it the same way, so
 *  the helper lives here: trim + lowercase, because the key must not fork
 *  on "Salma@Campus.ma" vs "salma@campus.ma". */
export function loginKey(email: string): string {
  return `login:${email.trim().toLowerCase()}`;
}

function singleton<T>(name: string, create: () => T): T {
  const g = globalThis as Record<string, unknown>;
  return (g[name] ??= create()) as T;
}

export const loginLimiter = singleton("cp_login_limiter", createRateLimiter);
export const rsvpLimiter = singleton("cp_rsvp_limiter", createRateLimiter);
export const trafficLimiter = singleton("cp_traffic_limiter", createRateLimiter);

/** 8 failed logins per email per 10 minutes; a success forgives. */
export const LOGIN_LIMIT = { limit: 8, windowMs: 10 * 60_000 } as const;
/** 10 RSVP/cancel attempts per user per minute (both share one bucket —
 *  toggling is the abuse pattern, not either action alone). */
export const RSVP_LIMIT = { limit: 10, windowMs: 60_000 } as const;
/** 60 recorded page views per visitor per 10 minutes: a fast human browsing
 *  never reaches it, a script replaying the beacon does. Keyed by the
 *  reporter's visitorId (the beacon is anonymous — there is no account or
 *  IP to key on that a NAT'd campus would not share). */
export const TRAFFIC_LIMIT = { limit: 60, windowMs: 10 * 60_000 } as const;
