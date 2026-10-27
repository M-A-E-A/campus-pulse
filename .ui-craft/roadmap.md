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

## Phase 2 — PWA + web push
Installable, offline fallback, web-push for the Phase 1 reminders. VAPID keys
are generated locally (no external account needed), unlike 1b.

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
