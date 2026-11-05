import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trafficLimiter, TRAFFIC_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Page-view beacon for the creator dashboard. The reporter in the root
 * layout POSTs here on every client-side navigation; this route stores
 * only what it can validate and fails closed (400) on anything that does
 * not look like a real in-app path. Public by design — every visitor
 * calls it — so the protection is validation plus a per-visitor rate
 * window, not authentication.
 */
function field(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 && v.length <= max ? v : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const path = field(b.path, 400);
  // Absolute URLs, protocol-relative hosts and the API's own namespace are
  // not page views — reject instead of storing noise the console would
  // then have to explain.
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/api/")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const visitorId = field(b.visitorId, 64);
  if (!visitorId || !/^[A-Za-z0-9-]{8,64}$/.test(visitorId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const referrer = field(b.referrer, 500);

  const key = `traffic:${visitorId}`;
  if (trafficLimiter.exceeded(key, TRAFFIC_LIMIT.limit)) {
    return NextResponse.json({ ok: false, limited: true }, { status: 429 });
  }
  trafficLimiter.record(key, TRAFFIC_LIMIT.limit, TRAFFIC_LIMIT.windowMs);

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  try {
    await prisma.pageView.create({ data: { path, referrer, visitorId, userAgent } });
  } catch (error) {
    console.error("traffic: page view write failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
