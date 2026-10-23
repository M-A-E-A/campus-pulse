import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Anti-screenshot QR payloads, airline-boarding-pass style.
 *
 * A ticket's raw code never appears in the QR anymore. Instead the QR
 * encodes `code|bucket|hmac` where:
 *   - bucket = Unix minute window (60s slots), so a screenshot of the QR
 *     stops verifying after its slot passes;
 *   - hmac   = HMAC-SHA256(secret, "qr:<code>:<bucket>"), truncated.
 *
 * The scanner accepts the current slot and ±2 for clock skew. Manual code
 * entry keeps working with the raw code (also what the tests use): the
 * raw code itself is still the secret, the QR is just a signed wrapper.
 *
 * The signing secret derives from AUTH_SECRET so no new env var is needed;
 * the context prefix keeps the derived key separate from session tokens.
 */

const WINDOW_SEC = 60;
const SKEW_BUCKETS = 2;
const SIG_LENGTH = 22; // base64url bytes kept — 128 bits

function secret(): Buffer {
  const base = process.env.TICKET_QR_SECRET ?? process.env.AUTH_SECRET;
  if (!base) throw new Error("TICKET_QR_SECRET or AUTH_SECRET must be set");
  return createHmac("sha256", base).update("campus-pulse:ticket-qr:v1").digest();
}

function sign(code: string, bucket: number): string {
  return createHmac("sha256", secret())
    .update(`qr:${code}:${bucket}`)
    .digest("base64url")
    .slice(0, SIG_LENGTH);
}

/** Current Unix time window for QR rotation. */
export function currentBucket(now = Date.now()): number {
  return Math.floor(now / 1000 / WINDOW_SEC);
}

/** Seconds until the current QR slot ends (for the client refresh timer). */
export function secondsUntilRotation(now = Date.now()): number {
  return WINDOW_SEC - Math.floor((now / 1000) % WINDOW_SEC);
}

/** Mint a signed QR payload for a ticket code, valid for this time slot. */
export function mintQrPayload(ticketCode: string, now = Date.now()): string {
  const bucket = currentBucket(now);
  return `${ticketCode}|${bucket}|${sign(ticketCode, bucket)}`;
}

export type QrVerifyResult =
  | { ok: true; code: string }
  | { ok: false; reason: "malformed" | "badSignature" | "expired" };

/**
 * Verify a scanned QR payload.
 * `payload` is the exact string the QR encoded; anything that isn't in
 * `code|bucket|hmac` shape returns "malformed" so the caller can decide
 * (the door UI treats it as a raw code instead).
 */
export function verifyQrPayload(payload: string, now = Date.now()): QrVerifyResult {
  const parts = payload.split("|");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [code, bucketRaw, signature] = parts;
  const bucket = Number(bucketRaw);
  if (!code || !Number.isInteger(bucket) || !signature) {
    return { ok: false, reason: "malformed" };
  }

  const expected = sign(code, bucket);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "badSignature" };
  }

  const delta = Math.abs(currentBucket(now) - bucket);
  if (delta > SKEW_BUCKETS) return { ok: false, reason: "expired" };

  return { ok: true, code };
}
