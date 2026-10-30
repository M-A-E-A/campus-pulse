/**
 * The one service-worker cache in this app that stores personalized page
 * HTML. Everything else the SW caches is immutable build output
 * (`/_next/static/`, `/icons/`) or the session-free `/offline.html`.
 *
 * The name MUST match TICKET_CACHE in public/sw.js — that file is plain
 * JS served from /public and cannot import from src/, so the string is
 * written twice on purpose with each side pointing at the other.
 *
 * Why one route is allowed to break the "never cache page HTML" rule: a
 * ticket you cannot open at the door is worthless, and campus wifi fails
 * precisely at the door. The rule exists to stop a shared machine handing
 * one student another's cached dashboard — so every path that WRITES this
 * cache has a path that DELETES it: sign-out purges it, and the ticket
 * page itself offers "Forget this device".
 */
export const TICKET_CACHE = "cp-ticket-v1";

/** Drop every ticket page saved on this device. Never throws. */
export async function purgeTicketCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(TICKET_CACHE);
  } catch {
    // Storage disabled (private mode, blocked cookies): nothing was saved,
    // so there is nothing to purge — not an error the student can fix.
  }
}
