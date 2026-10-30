/* Campus Pulse service worker — hand-rolled, no build step.
 *
 * What it caches, and why the list is this short:
 *   /offline.html  precached, because it is the fallback for EVERY failed
 *                  navigation and must exist before the network drops.
 *   /_next/static/ content-hashed build assets: safe to cache-first forever,
 *   /icons/        they are immutable by construction.
 *   /tickets/*     the ONE exception below — the standalone door ticket.
 *
 * What it deliberately never touches:
 *   /api/*         session, auth, cron and RSVP mutations — caching any of
 *                  it would show stale identity or, worse, block a POST.
 *   non-GET        same reason; the handler returns before respondWith.
 *   page HTML      navigations are network-first with NO page cache: a
 *                  signed-out student on a shared machine must never be
 *                  handed someone else's cached dashboard, and fresh beats
 *                  stale for live seat counts. Offline then falls back to
 *                  the precached shell page, which carries no session data.
 *
 * The exception, and why it is not a contradiction: a ticket you cannot
 * open at the door is worthless, and campus wifi fails exactly then. So
 * /tickets/* keeps its own saved copy in cp-ticket-v1 — network-first like
 * every other navigation (online always wins with a fresh, correctly
 * authorized render), with the saved copy used ONLY when the network is
 * unreachable. It dies with the session: sign-out purges it and the page
 * offers "Forget this device" (src/lib/ticket-cache.ts). Everything else
 * stays uncached, so the blast radius of a shared machine is one route the
 * next student would have to know the cuid for.
 *
 * Push: the server sends only a small JSON payload it rendered in this
 * device's locale (captured at subscribe time), so this file never needs a
 * dictionary — it just displays what it is handed.
 */

const OFFLINE_URL = "/offline.html";
const CACHE = "cp-static-v1"; // bump the name to orphan old caches on deploy
// Must match TICKET_CACHE in src/lib/ticket-cache.ts (that file cannot be
// imported here — this one is plain JS served from /public).
const TICKET_CACHE = "cp-ticket-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()) // activate with the next reload, not after an arbitrary tab
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Orphan every stale cache EXCEPT the ticket wallet: it holds the
        // student's own ticket and must survive a deploy, or going offline
        // would silently break the next time the worker updated. Network-
        // first means a fresh copy replaces it on the next online visit.
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== TICKET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cached, never intercepted

  if (url.pathname.startsWith("/tickets/")) {
    // The one route allowed to keep a saved copy of its own HTML — see the
    // header. Network-first, so a logged-in student online always gets the
    // server's fresh, correctly-authorized render; the saved copy is used
    // only when the network itself is unreachable.
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(TICKET_CACHE);
            cache.put(req, res.clone());
          } else if (res.status === 401 || res.status === 403 || res.status === 404) {
            // Definitive "not yours / no longer there": the saved copy must
            // not outlive that verdict. A 5xx is transient, so it keeps the
            // offline copy — the ticket is still the ticket.
            const cache = await caches.open(TICKET_CACHE);
            cache.delete(req);
          }
          return res;
        } catch {
          const hit = await caches.match(req);
          // No saved copy (never opened here, or signed out): fall through
          // to the session-free shell rather than invent a ticket.
          return hit ?? caches.match(OFFLINE_URL);
        }
      })()
    );
    return;
  }

  if (req.mode === "navigate") {
    // Network-first: fresh when online, offline page when the network fails.
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone()); // only 2xx; a 500 page must not stick
        return res;
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Campus Pulse", body: "", url: "/dashboard", lang: "fr", dir: "ltr", tag: "" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text(); // plaintext payload still deserves showing
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      lang: data.lang, // the OS renders the sentence RTL when dir says so
      dir: data.dir,
      tag: data.tag, // same event+type collapses instead of stacking
      icon: "/icons/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      // Reuse an open tab when there is one (focus, then take it to what the
      // push was about) — a notification tap should land somewhere, never
      // spawn duplicates next to a tab the user already had open.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
