import { pushPublicKey } from "@/lib/push";

/**
 * The public VAPID half, so the browser can subscribe without the key living
 * in a NEXT_PUBLIC_* bundle variable (which would need a rebuild to rotate).
 *
 * Public by design — a VAPID public key only ever signs messages *toward*
 * the push service; the private half stays in .env and never leaves the
 * server. No auth: it is read before any interaction and identifies nobody.
 *
 * force-dynamic: environment is read at request time, so a key rotation
 * takes effect without rebuilding.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = pushPublicKey();
  if (!publicKey) {
    return Response.json(
      { ok: false, error: "push is not configured (PUSH_VAPID_* missing)" },
      { status: 503 }
    );
  }
  return Response.json({ ok: true, publicKey });
}
