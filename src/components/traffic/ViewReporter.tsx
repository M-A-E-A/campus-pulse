"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Page-view beacon for the creator dashboard: one POST per client-side
 * navigation, fire-and-forget. It renders nothing and never blocks paint.
 *
 * HONEST SCOPE — a row means "a real browser rendered this page": no JS,
 * no row (this app is unusable without JS anyway), and the console's own
 * pages are never reported, so the creator checking their dashboard does
 * not inflate the numbers they came to read. Dev Strict Mode double-fires
 * effects; `lastSent` collapses that to one row.
 */
const VISITOR_KEY = "cp-visitor";

function randomId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const fresh = randomId();
    localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked (private mode): still count the view, under a
    // per-load id — losing uniqueness beats losing the row.
    return randomId();
  }
}

/** First entry keeps the browser's own referrer (same-origin reduced to
 *  its path); later entries name the page we just left. */
function referrerFor(previous: string | null): string | null {
  if (previous) return previous;
  const from = document.referrer;
  if (!from) return null;
  try {
    const url = new URL(from);
    if (url.origin === window.location.origin) return url.pathname;
    return from.slice(0, 500);
  } catch {
    return null;
  }
}

export function ViewReporter() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/creator")) return;
    if (lastSent.current === pathname) return;
    const referrer = referrerFor(previous.current);
    previous.current = pathname;
    lastSent.current = pathname;

    fetch("/api/traffic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer, visitorId: visitorId() }),
      keepalive: true,
    }).catch(() => {
      // Best effort: a lost beacon is one missing row, never an error
      // the visitor should see.
    });
  }, [pathname]);

  return null;
}
