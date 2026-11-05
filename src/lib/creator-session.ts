/**
 * Signed session cookie for the creator console — deliberately outside
 * NextAuth: the creator is the site owner, not an account in the user
 * table, and the credentials live in .env (gitignored) rather than in the
 * database. One person, one console, zero rows in User.
 *
 * The token is `${exp}.${hmac}` where the HMAC covers a domain-separated
 * payload (`cp-creator:${exp}`) keyed by AUTH_SECRET (or a dedicated
 * CREATOR_SESSION_SECRET). Pure Web Crypto so the same file runs in the
 * server action (node) and in any other request context — no Prisma, no
 * bcrypt, edge-importable, fail-closed when the secret is missing.
 */

export const CREATOR_COOKIE = "cp-creator";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DOMAIN = "cp-creator";

function secret(): string | null {
  const s = process.env.CREATOR_SESSION_SECRET ?? process.env.AUTH_SECRET;
  // Short secrets are refused outright: AUTH_SECRET is generated, and a
  // hand-typed weak value must not silently become a forgeable cookie.
  return s && s.length >= 16 ? s : null;
}

/** Everything the login flow needs to know before it renders a form. */
export function creatorConfigured(): boolean {
  return Boolean(process.env.CREATOR_LOGIN && process.env.CREATOR_PASSWORD && secret());
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secretValue: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

/** Constant-time compare of two same-shape strings (HMAC output, or the
 *  SHA-256 digests `secretEquals` produces). The length early-return leaks
 *  only length, which both sides already know. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Compare a submitted credential against the configured one without ever
 * running the raw strings against each other: both sides are hashed first,
 * so the comparison is fixed-length and reveals neither the password's
 * length nor its bytes through timing.
 */
export async function secretEquals(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const digest = async (v: string): Promise<Uint8Array> =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(v)));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Mint a fresh token, or null when no usable secret is configured. */
export async function signCreatorSession(now = Date.now()): Promise<string | null> {
  const s = secret();
  if (!s) return null;
  const exp = Math.floor((now + TTL_MS) / 1000);
  const sig = await hmac(s, `${DOMAIN}:${exp}`);
  return `${exp}.${sig}`;
}

/** Verify signature AND expiry. Anything malformed fails closed. */
export async function verifyCreatorSession(value: string | undefined | null): Promise<boolean> {
  const s = secret();
  if (!s || !value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(value.slice(0, dot));
  if (!Number.isInteger(exp) || exp * 1000 <= Date.now()) return false;
  const sig = await hmac(s, `${DOMAIN}:${exp}`);
  return safeEqual(sig, value.slice(dot + 1));
}
