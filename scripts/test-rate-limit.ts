/**
 * Phase 15, part B — structural gate for the rate limiter.
 *
 * Runs `createRateLimiter` on a FAKE clock: no sleeps, no flake. Covers
 * the semantics both hooks rely on: read-only peek, attempt counting,
 * `justLocked` firing exactly once per window, successful-login reset,
 * window expiry, the prune bound, and key normalization (the two call
 * sites — authorize and loginAction — MUST derive the same key or the
 * reset would never reach the counter that locked the account).
 *
 * Run: npx tsx scripts/test-rate-limit.ts
 */
import { createRateLimiter, loginKey, LOGIN_LIMIT, RSVP_LIMIT } from "../src/lib/rate-limit";

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, cond: boolean, detail: string) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

let now = 1_000_000;
const rl = createRateLimiter(() => now);

// 1 — a fresh key is not exceeded; the peek never creates a bucket.
check("fresh key not exceeded, peek is read-only", !rl.exceeded("k", 3) && rl.size() === 0, `size=${rl.size()}`);

// 2 — attempts count up to the limit without tripping early.
rl.record("k", 3, 100);
rl.record("k", 3, 100);
check("below the limit stays open", !rl.exceeded("k", 3), "2 records of 3");

// 3 — the THIRD record locks, and justLocked fires on that hit alone.
const second = rl.record("k", 3, 100);
const beyond = rl.record("k", 3, 100);
check(
  "record at the limit locks; justLocked fires exactly once",
  second.locked && second.justLocked && beyond.locked && !beyond.justLocked && rl.exceeded("k", 3),
  `2nd={locked:${second.locked},just:${second.justLocked}} 3rd={locked:${beyond.locked},just:${beyond.justLocked}}`
);

// 4 — clear forgives (a successful login), and the key is open again.
rl.clear("k");
check("clear forgives the failures", !rl.exceeded("k", 3), "post-clear");

// 5 — a bucket left alone expires with its window.
rl.record("exp", 1, 100);
const lockedNow = rl.exceeded("exp", 1);
now += 101;
check("window expiry reopens the key", lockedNow && !rl.exceeded("exp", 1), `now advanced 101ms over 100ms`);

// 6 — a spammer cycling keys cannot grow the map forever: past 1000
//     entries, the next record sweeps expired buckets.
for (let i = 0; i < 1005; i++) rl.record(`spam:${i}`, 5, 10_000);
const before = rl.size();
now += 10_001;
rl.record("post-sweep", 5, 10_000);
const after = rl.size();
check("expired buckets are pruned under key-spam", before > 1000 && after <= 2, `before=${before} after=${after}`);

// 7 — key normalization: authorize and loginAction must agree, or a reset
//     would never reach the counter that locked the account.
check(
  "loginKey trims and lowercases",
  loginKey("  Salma@Campus.MA ") === loginKey("salma@campus.ma") && loginKey("a@b.ma").startsWith("login:"),
  loginKey("  Salma@Campus.MA ")
);

// 8 — the shipped limits are the documented ones (a silent drift here
//     would change production behavior with no test noticing).
check(
  "shipped limits match the documented contract",
  LOGIN_LIMIT.limit === 8 && LOGIN_LIMIT.windowMs === 600_000 && RSVP_LIMIT.limit === 10 && RSVP_LIMIT.windowMs === 60_000,
  `login ${LOGIN_LIMIT.limit}/${LOGIN_LIMIT.windowMs}ms, rsvp ${RSVP_LIMIT.limit}/${RSVP_LIMIT.windowMs}ms`
);

const passed = results.filter((r) => r.pass).length;
console.log(`\ntest-rate-limit: ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
