# Campus Pulse — next-level roadmap

Post-redesign feature build, in the agreed order. Each phase ends with the
existing gates: `tsc --noEmit`, `eslint .`, `npm run build`, smoke test, and
the inspector at 0 FAIL on touched pages.

## Phase 1 — Notifications (in-app) ✅ DONE (verified)
The retention foundation. An events platform with no heartbeat between
"I RSVP'd" and "I showed up" is a bulletin board.

- [x] `Notification` model: stores a `type` + `eventId`, NOT rendered text —
      the site is trilingual (fr/en/ar) so strings render at read time in the
      viewer's locale; the event title comes from the relation. A nullable
      `dedupeKey` + `@@unique([userId, eventId, dedupeKey])` makes every
      trigger idempotent (NULLs don't conflict, so one-off rows stay free).
- [x] `notifications-core.ts` — create helpers, free of Next.js context so
      they're unit-testable (mirrors `rsvp-core.ts`).
- [x] Triggers:
  - waitlist → confirmed (inside `performCancelRsvp`'s locked transaction —
    seat and notification commit or roll back together)
  - event cancelled → all attendees (`cancelEventAction`, guarded by
    `wasAlreadyCancelled`)
  - club publishes a new event → followers (`approveEventAction`, guarded by
    `updateMany count === 1`)
  - reminder 24h / 1h before start (`/api/cron/reminders`, CRON_SECRET,
    constant-time compare, fails closed with 503 when unconfigured; windows
    are disjoint so an event never gets both passes at once)
- [x] `markRead` / `markAllRead` actions (scoped to the session user in the
      WHERE clause) + bell UI in the nav (unread badge, sr-only "New" so
      state never rides on colour, Escape + outside-click dismissal).
- [x] i18n `notifications.*` in en/fr/ar (tsc enforces completeness).
- Verification: tsc 0 · eslint 0 · build 0 · smoke 31/31 · functional probe
  18/18 (promotion, dedupe, cron over HTTP, both fan-outs) · bell interaction
  probe 11/11 (badge, aria-label, poster styles measured, mobile fit) ·
  inspector 0 FAIL / 1 defended WARN at baseline motion parity.
- Per-user feed deliberately NOT in `unstable_cache` (shared cache = a
  cross-user leak); the Nav is dynamic via `auth()` anyway.
- `EVENT_CANCELLED` rows link to `/dashboard`, not `/events/[id]` — a
  cancelled event's page `notFound()`s by design.

### Phase 1b — Email delivery (BLOCKED on credentials)
Same triggers, email channel. Needs SMTP/Resend credentials in `.env` —
design the mailer behind a provider interface, ship when creds exist.

## Phase 2 — PWA + web push ✅ DONE (verified)
Installable, offline fallback, web-push for the Phase 1 reminders. VAPID keys
are generated locally (no external account needed), unlike 1b.

- [x] **Icons** — `scripts/gen-pwa-icons.mjs` renders the Logo.tsx mark through
      Chromium (no image deps): 192/512 + maskable-512 (64% scale, inside the
      80% safe circle Android crops to) + `app/icon.png` (first tab favicon)
      + `app/apple-icon.png`.
- [x] **Manifest** — `app/manifest.ts`, localised name/description via `getT`
      like every other metadata field, `standalone`, paper bg / ink theme,
      scope `/`. Layout gains the `viewport` export (Next 15 moved
      `themeColor` there) + `appleWebApp` for iOS home-screen chrome.
- [x] **Service worker** — hand-rolled `public/sw.js`: precaches only
      `/offline.html` (+ icon); network-first navigations with offline
      fallback, cache-first for content-hashed `/_next/static/` + `/icons/`;
      **never** touches `/api/` or non-GET. No page HTML is ever cached — a
      cached dashboard on a shared machine is a session leak, and live seat
      counts beat stale ones. Registered by `RegisterSW` in the root layout,
      production-only (a dev SW would cache HMR assets).
- [x] **Offline page** — static `public/offline.html`, zero external
      references (it is what you get when the network is gone), trilingual via
      the `cp-locale` cookie with device-language fallback, correct RTL, poster
      card framing.
- [x] **Web push** — `PushSubscription` model (endpoint unique, `locale`
      captured at subscribe time because a push has no request to read a
      cookie from); `Notification.pushedAt` NULL = push owed. `push.ts`
      dispatches: newest owed row per user only (superseded = the bell keeps
      history), marks all owed rows on ≥1 accepted send, deletes subscriptions
      on 404/410, topic/TTL/8s-socket-timeout set, and **never throws** into
      an action. Fan-out creators now return `{created, userIds}` — `created`
      keeps the cron/probe "how much work happened" meaning, `userIds` feeds
      dispatch. `RsvpResult.promotedUserId` carries the promotion out of the
      transaction so the push fires only after commit (a rollback must never
      celebrate a seat it refused). Dispatch call sites: cancel (promotion),
      cancel-event, approve, cron — via `after()` in actions (post-response,
      zero UI latency), awaited in the cron.
- [x] **Subscribe flow** — server actions upsert by endpoint (rebind on
      re-login, prune own rows only), `GET /api/push/public-key` serves the
      public VAPID half (503 when unconfigured; private key never leaves
      `.env`). Toggle lives in the bell panel footer: unsupported → hidden,
      default → enable, granted → on/off, denied → honest "blocked in browser
      settings" hint; payload renders in the app locale the device chose.
- [x] i18n `notif.push.*` en/fr/ar. Custom `beforeinstallprompt` UI
      deliberately skipped — a valid manifest gets the browser's own install
      affordance (follow-up if we ever want an in-page CTA).
- Verification: tsc 0 · eslint 0 · build 0 · smoke **45/45** (14 new PWA
  checks: manifest shape incl. maskable, sw.js handlers, offline trilingual,
  public key, 5 icons, head links) · race 34/34 · notifications probe 18/18
  (`{created}` shape) · **new PWA probe 12/12** — SW active + controlling,
  offline navigation to `/dashboard` served from precache (emulated on both
  page and SW targets), permission → real toggle click → ON state, then a
  real encrypted push accepted by the push service (`sent:1`, `pushedAt`
  stamped, re-dispatch `sent:0`) and toggle back OFF · inspector 0 FAIL on
  dashboard (identical findings to baseline) and landing (sanctioned
  `few-pictures` allow; zero new findings). Motion count swings 0–11 across
  runs on BOTH sides of this phase — capture-timing race on pre-existing
  0.15s transitions, no CSS added here.

## Phase 3 — Poster engine
`GET /api/events/[id]/poster` → SVG rendered with the approved design tokens
(ink/paper/orange, Cabinet Grotesk), share via Web Share API, print-sized
export. The redesign's poster-wall metaphor becomes a distribution loop.

## Phase 4 — Live pulse
SSE endpoint so the organizer's attendance counter ticks during the door rush.

## Phase 5 — Organizer analytics
Per-organizer version of `/admin/insights` (registration over time, no-show
rate, check-in velocity). Mostly re-skins existing components.

## Phase 6 — Search
Full-text search across title / club / category / location, Arabic-aware.

## Phase 7 — Post-event loop
Thank-you screen + "would attend again?" that feeds recommendations.

## Throughout — credibility layer
E2E on the critical path (RSVP transaction, waitlist promotion, QR check-in),
GitHub Actions CI, rate limiting on auth/RSVP, audit log.
