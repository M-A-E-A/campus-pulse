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

## Phase 3 — Poster engine ✅ DONE (verified)
`GET /api/events/[id]/poster` → the shareable handbill, public like /calendar
(PUBLISHED only, 404 else), trilingual via `cp-locale`, `Cache-Control:
no-store` (the rail prints live counts), `Content-Disposition: inline;
filename="campus-pulse-<slug>.svg"`. Pure `src/lib/poster.ts` builds a
1200×1600 SVG: ink field, title auto-fitted 120→56px until the stack clears
the rail with air, category chip + club credits below it (truncated, and the
club drops to its own row when the chip would crowd it off-canvas), the
pulse beat re-plotted full-bleed running INTO the orange facts rail (dip
plunges into the band), footer rule + mark + wordmark + event URL — the
whole composition mirrored for RTL. SVG's `text-anchor` flips under
`direction="rtl"` ("start" pins the RIGHT edge there); one helper owns all
alignment, and every run carries its own direction so Latin lines inside an
Arabic poster (club, URL, time range) anchor as LTR instead of spilling.
Fonts are base64-embedded woff2 — Cabinet Grotesk 400/500/800 + IBM Plex
Sans Arabic 400/500/700 (arabic subset, copied from the build output into
`public/fonts/`), memoised per process, URL fallback if fs fails — so the
travelled FILE keeps its typeface on another device. Share:
`SharePosterButton` is a real `<a href>` (works pre-hydration, middle-click,
no popup blocker) enhanced to `navigator.share({files:[svg]})`; AbortError
= the share sheet was closed, not a failure; capability gap →
`window.open`. The same SVG IS the print export — vector, any DPI. New i18n
`detail.sharePoster`/`detail.sharePosterBusy` ×3 locales.
Verification: tsc/eslint/build 0 · smoke 53/53 (7 poster checks: 200 +
standalone SVG shape, embedded woff2, brand/facts/accent token, RTL via a
WebSession cookie — PS 5.1 silently drops `Cookie` from `-Headers`, draft
404, unknown 404) · probe-poster 8/8 (fr+ar render as top-level documents,
zero-width text 0/11 + 0/12, Cabinet + Plex really load, dir=rtl, 1200×1600
print canvas) · visual review of both renders caught and fixed 4 real
defects: the beat drew at the canvas top (missing translate — dead void
mid-poster), credits overflow (long category pushed the club off-canvas →
truncate + stack), ALL RTL text clipped off-margin (the anchor flip above),
title over-shrunk (advance estimates recalibrated 0.62/0.56/0.54 →
0.57/0.55/0.52, measured ~0.44–0.50) · inspector 0 FAIL, no new findings vs
the `inspect-p3` baseline (the `off-centre` warn disappeared).

## Phase 4 — Live pulse ✅ DONE (verified; shipped in fd3abbb, never gated)
SSE endpoint so the organizer's attendance counter ticks during the door rush.
`GET /api/events/[id]/pulse` is organizer/admin gated server-side, pushes a
change-only snapshot every 2.5s, heartbeats every 15s, and cleans up on
disconnect. `PulseScreen.tsx` is the projector door display: initial props
seed zeros, the first SSE frame paints the real totals (the "N confirmations"
line only appears once total > 0 — the stream's visible receipt), the count-up
/ progress fill / recent-row entrance fire per scan and snap under
prefers-reduced-motion. It is a documented exception to the dashboards-
animation-free lock: a presentation surface held on a projector for hours
stays still until the door moves, then the event is the motion. Trilingual
`pulse.*` dict; the attendees page links to it.
Verification: tsc/eslint/build 0 · smoke 55/55 (section 12: the stream
refuses anonymous 401 and refuses a signed-in student 403) · probe-pulse
7/7 door-rush E2E, fully re-runnable via `scripts/reset-checkins.ts` (door
starts closed, demo state ends back at the seed's 1 check-in): student
ticket from the real API → organizer session → projector opens → snapshot
paints totals from 0 → raw code typed into the check-in manual box (the
camera-free path) with a trusted CDP mouse click → green banner → counter
animates 0 → 1 on the SAME page, href untouched, no reconnect label.
House login pattern: node-side jar → Auth.js credentials callback →
Network.setCookie (clicking the React login form from CDP fires the POST
but the redirect never lands); seeded organizer email is `organiser@campus.ma`
(French spelling). Visual review of pulse-before/pulse-after + desktop/mobile
folds: centered stage, nothing clipped, hierarchy holds at 390px ·
inspector `inspect-pulse` 0 FAIL / 4 defended WARN with the sanctioned
`--allow still-page`: micro-label = tracked micro-caps are the locked
badge/label convention; palette-cream fires on #faf7f2 — that IS the locked
paper token (same defense as every page baseline); hero-void +
unused-canvas = the symmetric margins of a deliberately centered projector
stage, the detector merging the full-bleed section's left edge with the
header's inner right edge.

## Phase 5 — Organizer analytics ✅ DONE (verified)
Per-organizer version of `/admin/insights` (registration over time, no-show
rate, check-in velocity). Mostly re-skins existing components.
`/organizer/insights` reuses `<Insights>` VERBATIM — same stat row + heatmap
+ peak/legend, fed club-scoped data (session gate, middleware 307s anon and
non-organizers, scoping mirrors the dashboard: `clubMember` → clubId in
[...], admins see all). `campusBucket` moved from the admin page into
`src/lib/heat.ts` so both views bucket campus time identically (admin page
refactored to import it — byte-equivalent behavior). Beneath it, new client
`OrgInsights` renders the three roadmap metrics as div-bars (no canvas:
RTL flows for free, reduced-motion a non-issue, each bar carries its full
sentence as a native tooltip): registrations by week (18 zero-filled campus
Mondays over the same 120-day window, labels computed server-side per
request locale), check-in velocity (before / 0–15 / 15–30 / 30–60 / 60+
minutes from startsAt), and no-show rows per finished event (presence bar +
`w-28` nowrap rate). `oins.*` keys en/fr/ar in insights.ts, `org.insights`
link key in organizer.ts, dashboard header secondary button — paper outline
on the ink band via the documented @layer components → utilities override.
Seed: past-event RSVPs now backdate createdAt (1–6 days before start, both
branches) and checkedInAt rides the upsert's `update` with varied scan
offsets (−12/+4/+15/+28/+47/+75 min) so all five velocity buckets have demo
data — verification CAUGHT the first version leaving stale checkedInAt while
`upsertEvent` refreshed startsAt (every check-in sat −5745 min before its
event → bogus "before start: 5"); re-seeds now stay internally consistent.
Empty state (`oins.empty`) when no finished events; peak captions hide when
the data is empty instead of faking a sentence. Gates: tsc/eslint/build 0 ·
smoke 60/60 (section 13: anon 307, student 307, organizer 200 + heatmap
block + all three metric blocks) · inspector `inspect-insights` 0 FAIL /
1 defended WARN (palette-cream = the locked #faf7f2 paper token) with the
sanctioned `--allow still-page` (data surface, animation-free lock) ·
visual review desktop fold + 2 screens and mobile fold + 2 screens: charts
show the exact DB numbers (weekly 3/2/1 bars, peak "7 sept. · 3", velocity
1/1/0/1/2, ERC 33% / soudure 0% no-show), craft fixes landed for wrapped
rate text and mobile label truncation.

## Phase 6 — Search ✅ DONE (verified)
Full-text search across title / club / category / location, Arabic-aware.
Lives in `src/lib/search.ts`: `normalizeSearch` (lowercase, tashkeel +
tatweel strip, alef variants → ا, maqsura → ي, ta marbuta → ه, hamza carriers
ؤ/ئ → و/ي, bidi marks strip, Arabic-Indic + Extended digits → Latin,
whitespace collapse) runs on BOTH query and haystack, so decorated and bare
spellings meet in the middle; `searchMatches(fields, query)` treats an empty
query as match-all. `EventsExplorer.matchesFilters` now feeds it
`${title} ${location} ${club.name} ${category.name}` — the old matcher
silently missed category. Data fetching untouched (still client-side over
the shared 60s cached wall; `/events` 13.3 → 13.4 kB).
`scripts/probe-search.mjs` (run via `node --import tsx`) = 17 checks: 9 unit
checks importing the SHIPPED module (Arabic side can't be exercised by the
Latin-only seed: alef fold, tashkeel/tatweel, ta-marbuta ↔ maqsura pair,
hamza carriers, Arabic-Indic digits, bidi marks, symmetric decoration-proof
match, false-positive refusal) + 8 browser checks driving the real filter —
wall 5 cards; `minuit` → 1/5 (title), `innovation` → 3/5 (club),
`automatisme` → 2/5 (category — the field the old matcher missed; it would
return 0), `casablanca` → 1/5 (location); `miُnuit` (damma inside the word)
lands on the exact same card as `minuit`; garbage query → 0 cards +
`.empty`; clearing restores 5/5. Screenshot `.taste-skill/search-cover.jpg`.
Verification CAUGHT three of its own wrong assumptions before the run: (a)
three unit expectations forgot the ة→ه mapping ("قاعه"/"روضه", and the
maqsura pair must not mix a definite article); (b) `soudure`/`génie` exist
ONLY on the draft event — `getPublishedEvents` is `PUBLISHED && endsAt >=
now`, so browser strings were re-derived from the 5-card wall (`minuit`,
`automatisme`); (c) cdp.mjs `eval(fnOrExpr, arg)` inlines the arg only on
the FUNCTION branch — passing a string drops it silently (first run: all
five browser checks no-op'd at 5/5); fixed by passing a real function.
Gates: tsc 0 / eslint 0 / build 0 · smoke **60/60** · probe **17/17** ·
inspector public path (`skills/.../inspect.mjs --allow few-pictures`)
**0 FAIL / 4 WARN — all four defended**: palette-cream = locked #faf7f2
paper token; no-footage = typographic-poster direction (`realPictures: 0`
by design); off-centre 160/176 @1440 and 16/32 @768 = exactly 16px =
classic scrollbar gutter, `max-w-6xl mx-auto` content symmetric; still-page
(8 moved) = motion is interaction-driven (filter Flip + debounce), sanctioned
still-page class. Fold scored ≈9/10: print-spread registers, alternating
ink/accent/paper card deck, honest capacity copy (midnight-crossing range
printed in full, unlimited = "Ouvert à tous"). Ops note: postgres died
mid-verification and a stale `postmaster.pid` blocked start-db.mjs — cleared
the single lock file (pid confirmed gone first), DB re-booted, app recovered
untouched; smoke + probe re-ran green afterwards.

## Phase 7 — Post-event loop ✅ DONE (verified)
Thank-you screen + "would attend again?" that feeds recommendations. The
return leg of the campus loop: an events platform that ends at the door is a
bulletin board with better typography.

- [x] **Storage** — `attendAgain Boolean?` + `feedbackAt DateTime?` on `Rsvp`:
      feedback is 1:1 with the row that already is (userId, eventId), so no
      new table and no duplicate surface. Migration
      `20261028151213_post_event_feedback` applied, client regenerated.
- [x] **Band** — `PostEventThanks.tsx`, full-bleed ink band on the event
      detail page directly after the facts rail (the poster gains a closing
      cover, not a sidebar footnote), rendered ONLY for `hasEnded && session
      && own CONFIRMED RSVP`. Greeting splits on `checkedInAt`: "Merci pour
      votre présence." vs the no-show's honest "Merci pour votre
      inscription." — presence is claimed, never assumed. Question is yes/no
      + "Modifier ma réponse" (one question, two honest outcomes, reversible);
      a yes surfaces `detail.post.next` = that club's next published event,
      server-formatted in the page locale. `.detail-page .display-chapter`
      keeps the band heading under the event title at every width.
- [x] **Action** — `src/lib/actions/feedback.ts` `feedbackAction(eventId,
      attendAgain)` guards all four axes the UI shows (session, typeof
      boolean, event ended, own CONFIRMED rsvp — edge errors reuse the
      existing `detail.rsvp.*` keys), upserts both columns, revalidates the
      event page + dashboard.
- [x] **Dashboard** — `dash.recs.*` ("Because you liked…" / "Parce que vous
      avez aimé…" / "بناءً على ما أعجبك…") renders ALWAYS for signed-in
      students, full-width above the untouched two-column archive split,
      compact divider rows (a suggestion is not a ticket — no poster spines).
      Query: clubs from `attendAgain: true` rows → `endsAt >= now`,
      `rsvps: none: { userId }` (never recommend what's already in their
      pocket), `take: 4`; `.empty`-style copy teaches the loop.
- [x] **Seed** — soldering workshop (attended) pre-answered yes with
      `feedbackAt: daysAgo(43, 12)` so recommendations are live from first
      boot while every other past event stays unanswered (the question stays
      demonstrable).
- [x] **Emoji FAIL fixed** — the inspector's one FAIL was the `✓` character
      (follow button's on-state; the same latent hit lived in the check-in
      success banner and the calendar "copied" toast). Glyphs stripped from
      3 dicts × 3 locales, replaced by drawn SVG checks (`M20 6 9 17l-5-5`,
      currentColor) in `SaveFollowButtons` / `CheckInScanner` /
      `CalendarSubscribe` — `.btn`'s inline-flex + gap lays them out with no
      other CSS.
- **Probe** — `scripts/probe-feedback.mjs` = 14 checks, UI-driven and
  CONVERGENT from any stored state (reaches each state through "change my
  answer"; never touches the DB): anonymous sees no band; attended greeting;
  yes → answered + next-up that skips the ticketed event (scoped assertion);
  change reopens; no → no pick; dashboard empty state while nothing is liked;
  yes again → pick returns; recs list ETH + ERC while excluding the ticketed
  line-follower (scoped innerText); no-show greeted honestly and never shown
  a next-up; live event shows no band. Trusted CDP clicks (scrollIntoView →
  sleep(150) → mouse events); `data-post` hooks for structure, FR copy for
  wording (Chromium Accept-Language=fr; plain GETs render default EN — smoke
  section 14 asserts English, the probe asserts French).
- Verification: tsc 0 · eslint 0 · build 0 (`/events/[id]` 3.64 → 4.25 →
  4.29 kB, dashboard 1.44 → 1.57 kB) · smoke **67/67** (7 new: attended
  thank-you, state-aware band, no-show honesty, no band on live/anonymous,
  recs section, seeded ETH recommendation) · probe-feedback **14/14** first
  run · probe-pulse **7/7** re-run (door banner carries the new SVG check) ·
  inspector `inspect-thanks` **0 FAIL / 4 defended WARN** (palette-cream =
  locked #faf7f2 paper token; heavy-borders = drawn ink panel borders are
  the poster aesthetic; app-title-size = consumer event-poster page, the
  display title IS the design; colour-sprawl 13% = the accent facts rail,
  the signature band) · `inspect-dashboard` 0 FAIL / 1 defended WARN (same
  paper token) · screenshots scored: question ≈9/10, answered ≈9/10,
  dashboard ≈9/10, post-fix fold ≈9/10 (deductions: the live-capacity meter
  still renders on ended events — pre-existing surface, not this phase;
  next-up line is dense at 390px but holds two lines, no overflow).
- Flags, deliberately NOT touched: `rsvp-core.ts` has no `endsAt` guard (an
  RSVP to an already-ended event is possible — out of the RSVP-transaction
  scope); FR `dash.notCheckedIn` = "Non enregistré" is factually wrong (the
  row exists BECAUSE of her RSVP; EN "Not checked in" and AR "لم يُسجَّل
  الحضور" are correct — one-word fix "Non présenté" pending approval).

## Defect fix — offline mutations ✅ DONE (verified)
Offline login used to render the error boundary's "Quelque chose a cassé" —
an expected connectivity STATE wearing a crash costume (user-reported). Every
server-action surface now answers honestly instead of throwing into
`error.tsx`.

- [x] **Helper** — `src/lib/offline.ts` `isOfflineError(err)`:
      `navigator.onLine === false` OR a TypeError matching
      /fetch|network|load failed/ (Chrome "Failed to fetch", Safari "Load
      failed", Node "fetch failed").
- [x] **Copy** — `errors.offline` ×3 locales ("You're offline — reconnect,
      then try again." / "Vous êtes hors connexion — reconnectez-vous, puis
      réessayez." / "أنت غير متصل — أعد الاتصال ثم حاول مجدداً.").
- [x] **Auth forms** — LoginForm/RegisterForm wrap their server action
      inside `useActionState` (browser-side try/catch): offline returns
      `{ error: t("errors.offline") }` into the form's own `role="alert"`;
      genuine errors still rethrow to the boundary.
- [x] **Click surfaces** — RsvpSection (rsvp + cancel → inline message),
      SaveFollowButtons (optimistic toggle ROLLS BACK + note),
      PostEventThanks (`respond()` → band error slot), CheckInScanner
      (offline banner under the latest result; the manual box stays live —
      venue Wi-Fi dying must not kill the door).
- **Probe** — `scripts/probe-offline.mjs` = 7 checks via
      `Network.emulateNetworkConditions`: offline login → inline FR copy,
      no boundary, stays on /login; back online → retyped submit lands the
      session cookie (asserted with CDP `Network.getCookies`, not the
      redirect — probe-feedback's known CDP-redirect flake; React 19
      auto-resets an uncontrolled form after any action, so the retry
      retypes as a visitor would); offline feedback answer → honest band
      message, no boundary; online retry → converges to probe-feedback's
      end state (soldering = yes + next-up). Verify-and-retry band clicks
      (measure after the scroll settles).
- Verification: tsc 0 · eslint 0 · build 0 · probe-offline **7/7** ·
  probe-feedback **14/14** re-run (shared convergent end state) ·
  smoke 68/68.

## Phase 8 — Location-aware events ✅ DONE (verified)
"Events based on the user location", scoped BOTH ways: geolocation drives
nearest-first ordering with km on every card, and the first grant auto-picks
the visitor's campus (persisted, overridable). Geolocation is NEVER requested
on load — only by the "Near me" click; the detail chip renders only when
permission was already granted.

- [x] **Schema** — `Event.lat Float?` / `Event.lng Float?` (null = venue
      unknown / "à confirmer" → claims no distance). Migration
      `event_coords` applied (6 total), client regenerated.
- [x] **Seed** — venue-string → `VENUE_COORDS` map inside `upsertEvent`
      (district-level Casablanca approximations of the two campuses the demo
      data actually uses: EMSI Roudani cluster, EMSI Maarif cluster, Complexe
      sportif; unknown strings stay null). Midnight-pitch moved to "Amphi
      EMSI — Salle Atlas, Campus Maarif" so the 5-card wall carries one
      Maarif event and the campus flip is demonstrable (probe-search ratios
      unchanged — checked by hand).
- [x] **Geo lib** — `src/lib/geo.ts`: `CAMPUSES` (Roudani 33.5731,-7.5898 ·
      Maarif 33.5719,-7.6133 — district-level, never claimed
      survey-accurate), haversine `distanceKm`, `nearestCampus`, `formatKm`
      (Intl decimal per locale: 1,2 km / 1.2 km).
- [x] **Wall** — `EventsExplorer`: "Near me" toggle (drawn crosshair SVG,
      `aria-pressed`, no emoji) requests geolocation ON CLICK → strict
      distance order + `· X km` on every card with coords (venue-unknown
      events keep date order at the end, Infinity distance). First grant
      auto-picks the nearest campus → `localStorage["cp-campus"]`; the
      campus select (All / Roudani / Maarif) overrides or clears it;
      layered stable sorts tie-break on the server's list index so dealt
      poster slots never re-deal; Flip capture added to the location
      handlers (`flipState` ref hoisted above them), layout-effect dep
      `[filtered]` → `[ordered]`. Denied → honest "Localisation
      indisponible" hint, wall untouched.
- [x] **Detail** — `DistanceAway` chip "à X km de vous" under the venue —
      renders ONLY when `navigator.permissions` reports geolocation already
      GRANTED (a load never prompts; no grant = no chip at all).
- [x] **Data** — `getPublishedEvents` maps lat/lng; `EventCardData` gained
      lat/lng + the `distance` prop renders the label; dicts
      `events.nearMe / locDenied / campusLabel / campusAll` +
      `detail.distance` ×3 locales; smoke +2 (rail controls present).
- **Probe** — `scripts/probe-geo.mjs` = 10 checks
      (`Browser.grantPermissions` + `Emulation.setGeolocationOverride` at
      Smartilab Hall B): controls render; near-me → km on 5/5 cards;
      nearest-first (line-follower first); campus auto-picked + persisted;
      toggle-off removes labels; select maarif → Pitch de minuit first;
      selection survives reload; clearing restores date order + drops
      storage; detail chip renders when granted (its own target needs its
      own override — Emulation is per-renderer); permission reset → honest
      denied hint with `aria-pressed=false`.
- Verification: tsc 0 · eslint 0 · build 0 · smoke **68/68** (+2 here,
  both confirmed in output; file is additions-only vs HEAD, +124/−0) ·
  probe-geo **10/10** · probe-offline **7/7** · probe-feedback **14/14** ·
  probe-pulse **7/7** (scanner now carries the offline guard) · inspector
  public `/events` **0 FAIL / 4 defended WARN** (palette-cream = locked
  #faf7f2 paper token; no-footage = a poster wall with no honest clip —
  the wall IS the picture; off-centre 160/176 = the 16px scrollbar gutter,
  not a layout seam; still-page = load motion is the data-rise entrances,
  and reordering is interaction-driven Flip — deliberately not more load
  animation) · screenshots scored: desktop fold ≈9/10, mobile fold ≈9/10
  (nits: the rail wraps the campus select onto a second row at 1440, reads
  intentional with the view group opposite; the category select truncates
  at 390px — native behavior, pre-existing).
- Flags: the detail chip is straight-line distance to a district-level
  seed coordinate (demo data — honest label, not survey GPS); a real
  organizer flow would pick the venue on a map (seed maps strings today).

## Phase 9 — OG share posters ✅ DONE (verified)
Share previews for event links: a generated 1200×630 typographic poster
(no photos) served from `src/app/events/[id]/opengraph-image.tsx` via
`ImageResponse` (`next/og`). Poster system: ink `#14130f` field, paper
`#faf7f2` type, one accent `#ff4d00`, PulseMark glyph, FR dates (event data
language). Generic campuspulse card when the event is missing or not
PUBLISHED (never leaks a draft title — the card only prints data the detail
page already shows). Deliberately no live counts: scrapers cache these for
days, so a spot count would be lying by Tuesday. Layout:
`metadataBase` (env-driven — `NEXT_PUBLIC_SITE_URL`, falls back to the dev
origin); event `generateMetadata`: dropped the `coverImage` og:image branch
(the convention owns og:image), added
`twitter: { card: "summary_large_image" }`.
- Discovery: satori parses fonts with opentype.js, which **rejects woff2**
  (`Unsupported OpenType signature wOF2` — the route 500'd and killed the
  response pipe). Browsers take woff2, the renderer doesn't. Fix: wrote TTF
  twins (`src/fonts/cabinet-grotesk-{400,500,800}.ttf`, ~63KB each,
  `00 01 00 00` signature) with `wawoff2` from a Temp install — no new
  repo dependency; the site itself keeps loading the woff2 files.
- Discovery: the category chip (a full degree-track name) wrapped to two
  lines and collided with the wordmark — capped at 26 chars with an honest
  ellipsis + `whiteSpace: nowrap`.
- Verification: tsc 0 · eslint 0 · build 0 · smoke **70/70** (+2, both
  confirmed in output: `Head carries og:image poster` and
  `OG poster route serves PNG` — status 200, image/png, 50,988 bytes) ·
  probe-search **17/17** · probe-poster **8/8** · probe-feedback **14/14** ·
  probe-offline **7/7** · probe-geo **10/10** · probe-pulse **7/7** ·
  inspector event detail **0 FAIL / 2 defended WARN** (palette-cream =
  locked #faf7f2 paper token; no-footage = a poster wall with no honest
  clip) · og:image meta confirmed **absolute** (`http://localhost:3100/…`
  with width/height/type/alt, `twitter:card=summary_large_image`) · both
  PNGs fetched and scored: event card ≈9/10 (single-line chip, hierarchy
  title→club→rail), generic card clean and leak-free. Detail page
  screenshot unchanged (head-only edit), ≈9/10.

## Phase 10 — Campus map view ✅
Third view in the existing `EventsExplorer` group (`Filters.view:
"grid" | "calendar" | "map"`), new `src/components/events/EventsMap.tsx`.
Hand-drawn SVG, no tiles and no keys: a padded bounding box over
`CAMPUSES` + every event coordinate, cos(lat) corrected (a degree of
longitude is ~83 % of a degree of latitude at Casablanca — skipping it
squashes the whole field), fitted to a fixed internal 1000×700 grid. The
SVG stretches with `preserveAspectRatio="none"` while pins are real HTML
`<button>`s positioned at the identical normalised coordinates, so the
frame can distort but a pin can never drift off its venue — and buttons
keep the focus ring and the translated `aria-label` an SVG `<a>` would
have to reinvent. Pins are accent diamonds (rotated 45°, ink border),
selected = ink + accent ring, `aria-pressed`; events sharing one venue
fan out on a small arc (`FAN_R = 20px`) so each stays clickable.
Decoration: 2 px ink frame, accent-soft campus zones with the centre
marked at its true projection (the block never claims to be a surveyed
boundary), a dashed arc between campuses labelled with the real
haversine distance (2,2 km), north arrow, scale bar (largest round km
≤ 28 % of the field, so it reads at every zoom). Selected pin → that
event's `EventCard` reusing the wall's `slots`/`dealIndex`; honest hint
when nothing is picked. The `mapNoVenue` list under the map keeps
coordinate-less events visible — nothing is silently dropped.
- RTL decision: the page mirrors, the **map stays north-up and
  unmirrored** — mirroring a geographic field is a lie. Campus names are
  Latin proper nouns and render LTR.
- Three defects found and fixed during verification, all in the final
  build: (1) at 358 px the campus caption wrapped and the pins drew over
  it — the caption now caps its zone from above (positioned by `bottom`,
  so it stays glued to the box whatever the line height) and anchors
  right when the zone was nudged back from the frame edge; (2) bidi —
  the distance and scale chips printed `km 2.2` on the Arabic page, fixed
  with `dir="ltr"` on both; (3) probe-only, the app was correct: Chrome's
  `innerText` returns text **after** CSS `text-transform`, so the probe's
  literal `"Hors carte"` could never match rendered `"HORS CARTE"` —
  matched case-insensitively.
- Verification: tsc 0 · eslint 0 · build 0 · smoke **70/70** ·
  probe-geo **10/10** · probe-search **17/17** · probe-map **11/11**
  (view group carries the third control; wall picks up a temp
  coordinate-less event — `getPublishedEvents` is
  `unstable_cache(revalidate: 60)`, so the probe polls; map + 5 pins; the
  off-map list keeps that event; honest hint; pin → card with
  aria-pressed; re-click releases; search narrows to 1 pin; you-are-here
  gated behind consent; Arabic dir=rtl with all pins and a `خريطة
  الحرم` label; mobile 390 px no overflow, 5 pins) · screenshots scored
  (desktop, selected, consent, mobile, Arabic — meter is the floor).
  New test hooks: `data-view`, `data-map`, `data-pin`, `data-maphere` —
  locale-independent, since aria-labels translate.

## Phase 11 — Offline ticket wallet ✅
Standalone `/tickets/[rsvpId]` server page: the QR ticket gets its own
route so the door can open it with the network dead. Entry points:
`data-fullscreen-ticket` on each upcoming dashboard row plus the
full-screen link in `RsvpSection`. Owner-gated on the server
(`rsvp.userId === session.user.id`), and a foreign or absent id answers
**404, never 403** — a ticket is a credential, and a 403 would confirm that
somebody else's id exists. Three branches carry state honestly:
`WAITLISTED` → queue panel (no QR — a waitlist seat is not a ticket),
`CANCELLED` / non-`PUBLISHED` event → cancelled panel (no QR),
`CONFIRMED` → `TicketFull`.
- **The SW exception, and why it is safe**: `public/sw.js` allows exactly
  one cached-page route, `/tickets/*` → `cp-ticket-v1`, **network-first** —
  online always wins with a fresh authorized render, and the cache is only
  touched when the network fails. `res.ok` caches; `401/403/404` deletes
  the stale copy (a revoked ticket cannot linger behind a dead network);
  `5xx` keeps it (a server blip must not cost someone the door).
  `activate` preserves `cp-ticket-v1` so a deploy can't strand a ticket
  already saved — the network-first refresh re-hydrates it. Purged by
  sign-out (desktop `LogoutButton` in Nav, MobileNav item —
  `logoutAction` itself untouched) and by the "Forget this device" button:
  `purgeTicketCache` never throws and runs on click, before the round-trip.
  The cache name is necessarily duplicated in `src/lib/ticket-cache.ts`
  and `public/sw.js` (public JS cannot import from `src/`) — each carries
  a comment pointing at its twin.
- **QR offline is inherited, not reinvented**: `useTicketQr(rsvpId,
  ticketCode)` extracted and shared by `Ticket.tsx` and `TicketFull.tsx`
  so the two renders cannot drift; mint failure → the raw code
  (`checkin.ts` already accepts raw codes via its `includes("|")` gate);
  the anti-screenshot hint hides itself when `degraded` — claiming
  rotation over a static code would be a lie.
- **Wake lock is opt-in** (`WakeLock.tsx`): toggle defaults OFF (an
  unnoticed lock is a battery drain), feature-detected (`"wakeLock" in
  navigator`), re-acquires on `visibilitychange`, and tells all three
  truths — off = what it does, on+held = doing it, on+denied = can't.
- Dead copy removed: `ticket.owner` and `ticket.savedHere` deleted from
  en/fr/ar (unused). New `src/i18n/dict/tickets.ts` namespace ×3 locales.
- Locale-proof probe hooks (aria-labels translate): `data-ticket`,
  `data-ticketstate`, `data-fullticket`, `data-qr`, `data-code`,
  `data-wake`, `data-ticketoffline`, `data-forget`,
  `data-fullscreen-ticket`, `data-logout`.
- Probe hardening found during verification: the sign-out click landed
  **before hydration** — React owns that submit handler and the form has
  no native action to fall back on, so three consecutive clicks died
  silently (read like an app bug; it was timing). The probe now waits for
  React props on the form before the first click.
- Verification: tsc 0 · eslint 0 · build 0 · smoke **70/70** ·
  probe-wallet **15/15 ×3 consecutive** (login cookie · dashboard link
  `href=/tickets/…` · SW registered + controlling · `data-ticket=confirmed`
  · QR + legible code · wake switch · hint visible online · `cp-ticket-v1`
  cached · bogus id → **404** · offline: ticket opens from cache, code
  legible, honest banner, QR degrades with the hint suppressed · sign-out
  → `/` · cache gone) · inspector `inspect-auth` **0 FAIL / 4 defended
  WARN** with sanctioned `--allow still-page`: micro-label = the locked
  tracked micro-caps club line; palette-cream = locked #faf7f2 paper
  token; hero-void = the bilateral margins of the deliberately centered
  ticket object (card measured 512/512 at 1440); unused-canvas = the
  detector's `-1` left edge is the **sr-only skip link** ("Aller au
  contenu") clip rect and its `160` right edge is the header's inner edge,
  mirrored by the logo's own 160px margin — the frame is symmetric;
  still-page = animation-free utility lock (same class as the dashboard):
  the one mover measured is the mint spinner (`motion-reduce:animate-none`)
  — the surface must paint complete and scannable at the door. Screenshots
  scored: probe dashboard/online/offline + inspector desktop/tablet/mobile
  folds (≈9/10, meter is the floor); the offline render carries the amber
  "hors ligne" banner with the rotation hint suppressed.

## Phase 12 ✅ — Clubs directory + pages
`/clubs` = ink header + orange search rail + paper ClubCard grid
(monogram-stamp poster idiom; the header block is the link, FollowButton
sits in the footer strip; 250ms debounced search reusing `searchMatches`
over name+description). `/clubs/[id]` = ink band (RTL-safe back link,
accent monogram, display title) → orange action rail (FollowButton +
hint) → 3 ink-ruled stat boxes → À propos chapter → upcoming EventCard
wall (`data-rise` per card) or empty state; bogus id → `notFound()`.
Shared OG pipeline extracted to `src/lib/og.tsx` (event OG refactored
onto it; club OG = monogram + name + first description sentence on an
accent rail, static "CLUB" chip, no live numbers). `FollowButton`
extracted as a fragment with exported `toggleCls`; the follow action
revalidates `CLUBS_TAG` + `/clubs` + the profile path. EventCard and
ClubCard now declare `"use client"` — EventCard used hooks only
transitively, which 500'd the profile until fixed.
- Inspector: directory **0 FAIL / 5 WARN**, profile **0 FAIL / 8 WARN**,
  every WARN defended in writing (palette-cream = locked brand paper;
  few-pictures defended via `--allow` — the club data model has no
  photographs, the monogram stamp is the sanctioned poster idiom, and
  rendering 9 dynamic satori OG PNGs in a directory would tank
  performance — per-club OG posters still exist at
  `/clubs/[id]/opengraph-image` for shares; off-centre scrollbar gutter;
  ragged-edges/ragged-row editorial heights; heavy-borders poster
  idiom; app-title-size display-title; panel-void on the events wall;
  colour-sprawl ink+orange bands at tablet). still-page FAIL fixed by
  moving `data-rise` off the profile header onto its children and onto
  per-card wrappers (7 → 10 movers).
- Gates: tsc 0 · eslint 0 · build 0 · smoke **82/82** · probe-clubs
  **24/24** (search/empty/clear, profile counts, anon → login redirect,
  Salma's seeded follow round-trip N → N−1 → N proving revalidation,
  dashboard/nav/byline cross-links, RTL mirror, mobile no-overflow, OG
  served as real PNG, bogus id 404). Full probe matrix re-verified on
  touched surfaces: search 17/17, feedback 14/14, poster 8/8, wallet
  15/15 ×3, offline 7/7 ×2, geo 10/10, pulse 7/7, map 11/11. Screenshots
  scored (desktop/tablet/mobile folds both pages, AR mirror, profile).
- Probe hardening discovered en route: after an offline cut this Chrome
  build silently drops `Input.dispatchMouseEvent` — hit tests pass but
  zero native clicks reach the document. probe-wallet's sign-out loop
  and probe-offline's `click()` now verify delivery and fall back to a
  DOM `.click()`; assertions unchanged.
- Environment repair: the restart killed postgres mid-write and a Temp
  cleanup deleted relation files from `base/16384` (58P01 on every
  catalog read; `prisma db push --force-reset` couldn't even DROP
  SCHEMA). Cluster rebuilt from scratch in `Temp\opencode\pg-data-fresh`
  — the corrupted dir was never touched — then `db push` + seed;
  `start-db.mjs` DATA_DIR points at the fresh cluster with a comment.

## Phase 13 ✅ — Offline check-in queue
The door screen no longer loses a scan when venue Wi-Fi dies. A failed
(offline) scan is queued in `localStorage` (`src/lib/checkin-queue.ts`)
and re-sent on the page's `online` event, on the next scanner open, or
via the manual **Synchroniser** button — sequential sends (door Wi-Fi),
deduped by `(eventId, code)` so a QR held on a live camera queues once,
per-event so a scanner never flies another event's codes. No SW
Background Sync: localStorage drain covers reload-survival (same store
every load reads) and the service worker stays ticket-cache-only.
- Safety is the server's idempotency (`performCheckIn` fires only while
  `checkedInAt IS NULL`): replays answer honestly, so a mid-outage
  conflict — someone else checked the person in — drains to a real
  `duplicate` row, never a double count; a typo'd queued code drains to
  `invalid`. Auth death mid-drain stops the loop and KEEPS the queue with
  an honest "session expirée" alert (burning it into unauthorized rows
  would bury real people); storage refusal shows the red "scan was lost"
  alert instead of pretending. 6 new keys ×3 locales (`org.checkin.
  pendingCard/pendingItem/sync/syncing/syncBlocked/queueFull`; an
  unused `queuedBanner` was cut before it could become dead copy).
- Nav regression found by the inspector (Phase 12's Clubs link tipping
  the organizer's row 15px past 768): desktop link row and MobileNav
  switch `md → lg` (hamburger covers tablet for every role); the door h1
  goes `text-2xl sm:text-3xl` (phone title in the 20–24px app band).
- New `scripts/probe-door.mjs` **12/12**: online scan → ok; offline scan
  → queued card + count + "En attente" row (no crash screen); re-scan
  dedupes; storage holds the exact entry over a 3s outage window;
  back-online auto-drain (`drain=auto` — the `online` event fires under
  CDP emulation, Sync button kept as belt-and-braces); rescan of the
  drained code → `duplicate` = landed exactly once; mid-outage conflict
  → `duplicate`; queued garbage → honest `invalid` + "Code inconnu";
  storage empty after drains; mobile 390 load: no phantom queue, 0px
  overflow. Fixture is node-side and idempotent (Salma's ticket reset,
  Omar gets a fixed RSVP) so runs start from the same door state.
- Gates: tsc 0 · eslint 0 · build 0 · smoke **82/82** · probe-door
  **12/12** · probe-clubs **24/24** (Nav touched — cross-link assertion
  re-run) · inspector on the door screen **0 FAIL / 3 WARN** with
  sanctioned `--allow still-page` (written defense: animation-free door
  utility, same class as dashboard/ticket — the screen paints complete
  and feedback between scan and banner is instant by design) and the 3
  WARNs defended: palette-cream = locked brand paper; hero-void = the
  deliberate margins of the narrow focused door column (same family as
  the ticket page's centered-object defense); unused-canvas = the
  mirrored 160px nav gutter, identical measurement to the defended club
  profile. Screenshots scored: desktop fold, mobile fold, and the
  queued-state shot (green check banner → amber queue card with count +
  Sync — the whole contract legible in one glance).

## Quick win 2 ✅ — Ticket export: print → PDF + Apple .pkpass

Two exports on `/tickets/[rsvpId]` (agreed scope: "idea 1 and 2"):

- **Save ticket → print → PDF** — no credentials, works offline (the
  SW caches this one page). `window.print()` button + `@media print`
  scoped by `body:has([data-ticket])`: site header drops out, every
  app affordance is marked `data-print-hide` (badges, offline banner,
  QR hint + save link, wake lock, action rows, footer), the ink band
  flips to ink-on-white via `print:` utilities — never rely on browsers
  printing backgrounds (they don't by default → white text on white
  paper) — the card keeps its ink border, QR, code and venue line, and
  `break-inside: avoid` keeps the pass on one page. Hint copy sits at
  the 13px floor (first draft was `text-xs`/12px; caught before ship).
- **Apple Wallet `.pkpass`** behind env certs: `src/lib/pkpass.ts` =
  pass.json (barcode carries the RAW ticket code — a pass barcode
  cannot rotate, and the door accepts raw codes, same honest fallback
  as the degraded QR) → manifest of SHA-1s → detached PKCS#7 over the
  manifest (node-forge, sha256, openssl-style authenticated attributes,
  WWDR + signer certs in the bag) → flat zip (`adm-zip`). Route
  `GET /api/tickets/[rsvpId]/pass` reuses the QR route's owner guard
  (401/404/403/409). **Shipped state is honest-unconfigured** (all five
  `APPLE_*` unset, documented in `.env`): the ticket renders a note
  instead of a button (Phase 1b rule — no dead CTA), the route answers
  503 `not_configured`, and a configured-but-broken server degrades to
  the inline `walletError` + print fallback (fetch+blob, never a JSON
  error page shown to a student). Pass field labels come from the dict
  (5 keys ×3 locales) and the date from `formatDateTime`, so the pass
  speaks the student's language. Real-device import stays blocked on
  Apple's WWDR intermediate + pass type ID certificate; dev chains live
  in `.certs/` (gitignored).
- `scripts/test-pkpass.ts` **15/15**: env flips on with all five vars,
  one missing var = OFF; pass.json core/barcode/field/relevantDate
  contracts; zip = exactly the four root entries; manifest SHA-1s match
  the actual zipped bytes; icon bytes intact; signature parses as
  ContentInfo signedData carrying data+sha256+messageDigest — and
  **openssl cross-verifies the signature over the manifest**
  (`cms -verify -noverify` → "Verification successful"; openssl
  resolved relative to the Git install since it isn't on PATH).
- `scripts/probe-pass.mjs` **16/16**: anon → 401; FR button copy exact
  ("Enregistrer le billet"); Save-as-PDF hint; honest note with no
  button/error; route 503 + `reason=not_configured`; print emulation —
  header `display:none`, affordances gone (wake wrapper judged via its
  `data-print-hide` ancestor: a child of a hidden box still reports its
  OWN display), band `rgb(255,255,255)` + h1 ink (asserts away the
  white-on-white trap), QR `naturalWidth=320` + code visible; screen
  media restores chrome; logout → organiser session → Salma's pass →
  **403**. Login hardened to the probe-wallet lesson (hydrate the React
  form, listener-verified click, DOM fallback, one retry) — the second
  login flaked exactly the documented way before that.
- Deps: `node-forge` + `adm-zip` (+ `@types/*`). `pkpass.ts` is
  deliberately not `server-only` (the tsx test imports it in plain
  Node, where `server-only` throws); node:fs/node:crypto imports already
  keep it out of client bundles.
- Gates: tsc 0 · eslint 0 (caught `prop` never interpolated into the
  probe's eval string — a runtime ReferenceError waiting to happen) ·
  build 0 · smoke **82/82** · probe-wallet **15/15** (regression —
  ticket page touched) · probe-pass **16/16** · test-pkpass **15/15** ·
  inspector on the ticket page **0 FAIL / 4 WARN** (sanctioned
  `--allow still-page`; the same four defended Phase-11 findings:
  micro-label = club kicker in the poster idiom, palette-cream = brand
  paper, hero-void + unused-canvas = the narrow centered column's
  defended measurement). Screenshots scored: the print view reads as a
  real paper pass (chromeless, band inverted, QR crisp, one page), the
  desktop screen keeps one accent CTA over the honest note, and the
  mobile fold holds at 390.

## Phase 14 — camera QR scanner (harden the door path · poster → scan loop · native-first decode)
- `src/lib/qr-camera.ts` — one engine for both surfaces: native
  `BarcodeDetector` first, html5-qrcode (lazy import) fallback on ANY
  native start failure; typed `CameraError("insecure")` from
  `window.isSecureContext` read at start time (never on load, never a
  prompt before the tap); `stop()` idempotent — ends every track and
  clears the container. Failures land in
  `console.error("Camera start failed:", err)` so probes can assert
  them.
- Door scanner (`CheckInScanner`): same-QR camera cooldown 3s (manual
  entry deliberately bypasses it); hooks `data-scancard` / `scanmode` /
  `startcamera` / `stopcamera` / `cameramsg` / `historyrow`; an
  insecure context gets the shared honest `common.cameraInsecure`
  (the generic `org.checkin.cameraError` stays the non-insecure
  fallback).
- Student `/scan` (new page + `ScanScanner`): signed-in only
  (anon → /login); accepts only same-origin `/events/<id>` URLs
  (`new URL(text, location.origin)`); a foreign QR → honest inline
  `data-unknown` refusal and the camera KEEPS RUNNING; "Scanner" nav
  entry (`nav.scan`) for every signed-in user, desktop + mobile,
  after Mes billets.
- Poster: 208px white QR card on the orange rail's far side, vertically
  centered; vector modules (single merged `<path>` of horizontal runs
  from `QRCode.create` — no canvas dependency); the facts column
  reserves the card width and wraps clear of it; position mirrors for
  RTL, the pattern never does; no caption (the footer URL remains the
  human label); an encode failure never breaks the print. No new
  route — the QR rides the existing `input.url`.
- Probe lessons kept: this Chromium (`chromium-1248`) ships NO
  `BarcodeDetector` → the probe auto-asserts native mode when the
  browser has the API and SKIPs it honestly otherwise; `isSecureContext`
  is an OWN property here (restore sabotage with
  `defineProperty({value:true})` — a bare `delete` leaves it
  undefined→false); html5-qrcode's own check is
  `"BarcodeDetector" in window` (strip with pure `delete`); CDP eval
  returning `window` throws "Object reference chain is too long";
  probe state reads must be ONE atomic eval (React commits land
  between two evals); parallel inspector runs share
  `.taste-skill/inspect-auth` and crash — run sequentially with
  separate `--out` dirs.
- Gates: tsc 0 · eslint 0 · build 0 (`/scan` 1.98 kB) · smoke
  **82/82** · probe-camera **8/8** (native SKIP honest in this
  Chromium) · probe-scan **5/5 ×2 runs** (poster QR asserted
  structurally: 561 modules match the event-URL matrix, mod=4) ·
  regressions probe-door **12/12** · probe-poster **8/8** ·
  probe-clubs **24/24** · inspectors `/scan` + door check-in
  **0 FAIL / 3 WARN each** (sanctioned `--allow still-page`; the
  defended trio: palette-cream = brand paper, hero-void +
  unused-canvas = the capped max-w-lg working column). Screenshots
  scored: poster FR/AR — the QR card reads as a deliberate block on
  the rail's far side and RTL mirrors the position, not the pattern;
  the door shows the full loop (green "Salma Student est entré."
  banner over the viewfinder's qrbox corners, manual fallback below);
  /scan lands on the event page after a live decode, refuses a
  foreign QR with a red inline alert while the camera keeps running,
  and holds at 390.

## Quick win 5 ✅ — "who's going" attendee grid
- The social-proof chapter on the event detail page, between About and
  Organizer: 40px ink initial tiles (paper ring separation, logical `-ms`
  overlap so RTL reverses the stack — letters never mirror), 12 max plus
  a dashed "+N" ghost (reads as "truncated", not "one more person"), and
  a count line naming the first two RSVPs. All five plural line shapes
  live in the dict keys ×3 locales, so the component holds no locale
  logic.
- Disclosure contract (written into `AttendeeGrid`): FIRST NAMES ONLY —
  the public page stays at hallway-poster level; full names/emails stay
  behind the organizer door. CONFIRMED only (a waitlisted seat is not a
  going person), upcoming events only (an ended event has the post-event
  band — "y vont" over a past event would be a lie), zero-going shows
  nothing (no sad empty chapter). Anonymous and signed-in see the SAME
  block — no auth-conditional hiding.
- Phone guard found by the probe itself: 13 tiles = 424px, a 390px
  column overflowed by 50px → the stack now wraps into a small grid
  (`flex-wrap` + `gap-y-1`), desktop stays one row. Re-run: 0px.
- `scripts/probe-going.mjs` **10/10** with a self-cleaning fixture (two
  probe-owned events + 15 users, deleted at the end so smoke counts
  stay pristine): count attr, 12 letters + "+2", exact FR line,
  waitlisted rider absent, seeded three-name line computed from live DB
  order, ended + zero-going chapters hidden, Arabic heading/line exact
  (fresh browser → Accept-Language), mobile 0px overflow, signed-in
  parity. One atomic eval per state read.
- Gates: tsc 0 · eslint 0 · build 0 (`/events/[id]` 5.27 kB) · smoke
  **82/82** · probe-going **10/10** · regressions probe-poster **8/8**
  (the detail dict is the poster's copy source) · probe-feedback
  **14/14** · probe-scan **5/5** · probe-wallet **15/15** · inspector on
  the event page **0 FAIL / 4 defended WARN** — the exact Phase-7
  defended family (palette-cream = locked paper token; heavy-borders =
  drawn ink panels; app-title-size = the event-poster display title IS
  the design; colour-sprawl = the orange facts rail).
- Screenshots scored: desktop — the chapter lands in the poster rhythm
  (tiles echo the club initial card); AR — stack runs right-to-left,
  letters stay LTR, bidi line correct; mobile — clean two-row grid, no
  sideways scroll.

## Phase 15 ✅ — CI + rate limiting + audit log
All three remaining "credibility layer" items.

- **Rate limiting** — `src/lib/rate-limit.ts`: in-memory fixed window with
  an injectable clock (`createRateLimiter(now)`), three ops — `exceeded`
  (read-only peek, never extends a window), `record` → `{locked,
  justLocked}`, `clear` — and a prune bound (>1000 buckets sweep expired)
  so key-cycling cannot grow memory. Instances live on globalThis for the
  same reason the Prisma client does: `authorize` is in the route bundle,
  `loginAction` in the page bundle — separate module graphs, one shared
  counter. KEYING DECISION: login is keyed by EMAIL, not IP — hundreds of
  students share one campus NAT, so an IP cap would lock the whole school
  out while a per-account cap locks out exactly the attacker.
  `LOGIN_LIMIT` = 8 failures/10 min/email: authorize checks the lock
  (returns null → raw callback path is indistinguishable from a wrong
  password) and `clear`s on success (a correct password forgives);
  `loginAction` pre-checks for the honest `auth.error.tooManyAttempts`
  and records on every AuthError. RSVP + cancel share ONE per-user
  bucket (`RSVP_LIMIT` 10/min — toggling is the abuse pattern) answering
  `detail.rsvp.tooMany` in the existing status slot. Register deliberately
  has NO IP cap (same NAT reason; still guarded by email-taken + zod —
  email verification remains the real fix, flagged).
- **Audit log** — `AuditLog`: `actorId` (SetNull) + `actorName` /
  `targetLabel` snapshots so rows survive deletions (the Notification
  keep-history-legible reasoning); `action` stores the FACT, never a
  rendered sentence — the admin page translates
  `admin.audit.action.<action>` at read time (trilingual app), and an
  unknown action renders raw mono rather than hiding. `recordAudit`
  NEVER throws (a failed audit write must not undo the action it
  describes — it lands in the server log). 14 wired mutations:
  rsvp.created/cancelled (meta `promotedFromWaitlist`)/checked_in (ok
  only — duplicates are attempts, not state changes), event
  created/updated/submitted/cancelled/published/rejected (count===1
  guards), category.created/deleted, club.created,
  user.promoted_organizer, auth.rate_limited (`justLocked` fires once
  per window → ONE row per lockout, not one per spammed request).
  Ticket codes stay OUT of rows (bearer secrets).
- **Schema migration without a reset**: `pg-data-fresh` was db-push-built
  with no `prisma_migrations` history, and `migrate dev` demanded a
  destructive reset — NEVER reset. Applied via `db push` + hand-authored
  `20261031090000_audit_log/migration.sql` generated EXACTLY by
  `prisma migrate diff --from-migrations --to-schema-datamodel` against a
  scratch shadow DB — the diff contained only the audit delta, proving
  the migration files stayed in sync with the schema.
- **CI** — `.github/workflows/ci.yml`: ubuntu + postgres:16 service →
  `npm ci` → `prisma migrate deploy` (not db push — CI proves the
  migration FILES build a real schema) → seed → tsc → eslint →
  test-rate-limit → test-pkpass (openssl is on PATH on runners) → build →
  nohup start + curl wait → `pwsh scripts/smoke-test.ps1` → server.log
  on failure. HONEST BOUNDARY: the browser probes do NOT run in CI —
  they import the gitignored `.agents/` CDP harness; vendoring it into
  `scripts/` for Playwright-on-CI is the follow-up. CI's riskiest step
  was rehearsed locally: fresh scratch DB → migrate deploy applied all 7
  migrations incl. audit_log → seed → dropped.
- **Unit** — `scripts/test-rate-limit.ts` **8/8** on a fake clock (no
  sleeps): peek read-only, `justLocked` exactly once, clear, window
  expiry, prune under key-spam, `loginKey` trim+lowercase (both call
  sites MUST derive the same key or a reset never reaches the lock that
  blocked the account), shipped limits pinned.
- **Probe** — `scripts/probe-audit.mjs` **11/11**: 8 wrong-password
  attempts then the 9th shows the exact FR lockout copy in the existing
  `p[role="alert"]` slot; per-email keying (Salma's correct login lands
  immediately after the brute-force lockout); DB count = exactly ONE
  `auth.rate_limited` row; Salma's real RSVP writes `rsvp.created` with
  actor + event title; student bounces to `/` (page guard) and anon to
  `/login` (middleware gate) — both asserted; admin sees both rows with
  FR labels, zero raw-key leak (visible-text TreeWalker — raw
  `body.textContent` includes the inline i18n script payload, which was
  the first run's false positive); nav entry; both screenshots. Unique
  brute email per run: the limiter is in-memory, so a fixed email would
  start pre-locked inside the window and correctly write no second row.
- Probe lessons this phase added: a login helper must CLEAR THE JAR
  FIRST — a leftover session cookie satisfies the cookie wait before the
  new sign-in lands (the first run's "admin" was really the student,
  bounced to `/`); a form loop started without `page.goto` surfaced as
  "Illegal invocation" (native value setter on null) — `fillInput` now
  throws `no element: <sel>` instead.
- Gates: tsc 0 · eslint 0 (caught the vestigial `windowMs` on the peek —
  the read-only API honestly shrank to `exceeded(key, limit)`) · build 0
  (`/admin/audit` 175 B, dynamic) · smoke **82/82** · test-rate-limit
  **8/8** · test-pkpass **15/15** · probe-audit **11/11** · regressions
  probe-door **12/12** · probe-wallet **15/15** · probe-going **10/10** ·
  inspector `/admin/audit` **0 FAIL / 0 WARN** with sanctioned
  `--allow still-page,palette-cream` (both with written defenses:
  animation-free utility lock — same class as dashboard/ticket — and the
  locked #faf7f2 brand paper token) · CI fresh-DB rehearsal passed.
  Screenshots scored: the lockout state is the honest danger line in the
  form's own alert slot with no layout change; audit desktop ≈9/10
  (ink band nav with the orange active entry, four-column rhythm, muted
  targets); mobile ≈8/10 (the table scrolls inside its own container —
  the attendees-table idiom, zero page overflow; the full date column is
  chunky at 390 but consistent with the family rather than forking one
  table into cards).
- Evidence the writer works in the wild: tonight's door-probe run left
  two real `rsvp.checked_in` rows (actor snapshot "Omar Organisateur",
  real event title) visible in the inspected render — fixtures were not
  the only rows on the page.
- Flags: limiter is per-process — correct for today's single
  `next start`; horizontal scale would need a shared store, and
  `createRateLimiter` is the seam. The RSVP half is unit-proven, not
  e2e-triggered (10 real form actions/minute would add brittleness for
  no behavior the unit does not already prove). `auth.rate_limited`
  rows from probe runs persist in the dev DB — they are history, not
  fixture state (smoke counts unaffected). CI is authored and its
  migration path rehearsed, but its first real run happens on first
  push. Email verification still absent.

## Endgame — step 1: SVG logo pick ✅ DONE (verified)
Four compositions of the established PulseMark (tile ground × stroke
colour) rendered at real tab sizes (16–48px) in light + dark tab-strip
context — evidence sheet `.taste-skill/logo-pick-sheet.jpg`. Pick = **A:
ink tile + accent stroke**, the shipped favicon in vector form. B (accent
tile) is the loudest but the favicon isn't a CTA — orange is the app's
action colour and spending it on chrome dilutes it; C (paper tile)
vanishes on the light tab strip (its most common context); D (bare
stroke) is thinnest at 16px and abandons the established tile.
Continuity beat novelty at the finish line.

- `src/app/icon.svg` (32×32, ink rect + accent stroke at the same 68%
  mark scale) is written BY `scripts/gen-pwa-icons.mjs` — one script
  owns every icon, so the SVG can never drift from Logo.tsx or the
  PNGs. Re-rendering the set produced **zero byte churn** in all five
  PNGs (deterministic pipeline proven).
- Next 15.5 constraint found the hard way: the `icon.*` file convention
  can only yield ONE icon — `next-app-loader`'s `metadataResolver`
  stops at the first extension that exists (`!result` guard), so
  `app/icon.svg` got its ROUTE (200 image/svg+xml) but no `<link>`.
  The SVG-first / PNG-fallback pair is therefore declared explicitly in
  `layout.tsx` `metadata.icons`: SVG for every modern browser, PNG for
  Safari (no SVG favicon support); `app/favicon.ico` still auto-prepends
  as the legacy 16px entry and all four file routes keep serving — the
  block only replaces the head tags. Verified head order:
  favicon.ico → icon.svg → icon.png → apple-icon.png.
- Manifest keeps its PNG set (already vector-derived; iOS home screen
  ignores SVG regardless) — no manifest change.
- Smoke +2: `Icon /icon.svg` (200, image/svg+xml, accent bytes present)
  and `Head links SVG favicon` (asserts the ORDER — svg before the png
  fallback; the fallback only works that way).

Gates: tsc 0 · build 0 · smoke **84/84** (82 + the two favicon checks).

## Endgame — step 2: `npx ui-craft-detect ./src` ✅ DONE
npm v0.13.0 over all155 files → 40 flagged (9 errors / 48 warnings).
Triaged every finding; **fixed the 9 genuine ones**:
- form labels + autocomplete (CategoryForm, ClubForms — `aria-label`
  via dict keys ×3 locales, house pattern; the email example-address
  placeholder could not serve as its own label),
- two-step delete on /admin/categories (new `DeleteCategoryButton` +
  extracted `useConfirm` — the RejectForm pattern; the confirm button
  names the row; cancel disarms; opener never mutates),
- `transition-all` removed from the capacity bar (dead or layout-anim
  on a data readout — either way not shipped motion),
- two ALL-CAPS headings de-capped (CheckInScanner, EventsMap — the
  house rule is already written in globals.css: "uppercase tracked
  headers are the mark of the generated dashboard").

The other **48 findings defended in writing** (the detector is per-file
and state-blind; every defense is provable):
- 31 hover-without-focus-visible → the global `:focus-visible` ring
  (globals.css:67) covers every element in the app;
- 5 mixed px/rem → px hairline borders + rem layout is the detector's
  OWN recommended split (clamp() constants in the fifth);
- 3 tables → `overflow-x-auto` already present on all three; sticky
  thead cannot coexist with that scrollport (CSS forces overflow-y to
  auto, so page-level sticky never engages) without redesigning into a
  max-height scroll region — a design change, not a lint fix;
- 5 data-fetch-no-states → every one has explicit catch branches with
  probe-covered fallbacks (useTicketQr degraded→raw code + retry,
  TicketFull walletError→inline error + print fallback, PushToggle
  honest "off", RsvpSection translated messages incl. offline,
  SharePosterButton anchor-href + open-in-tab fallback);
- em-dash flood → all 12 em dashes in EventsExplorer.tsx are `//`
  comments (the detector quoted its own comment-extraction artifact);
  zero in visible copy;
- rounded-none×14 in the skeleton → skeletons mirror the real page's
  square-frame radius language (globals.css documents it);
- PulseScreen eyebrow → a status BADGE ("LIVE" pill), not a section
  eyebrow; transition-[width] → the signature live-pulse motion (700ms
  pill; scaleX would corrupt the rounded caps), globally killed under
  `prefers-reduced-motion` (globals.css:402 `transition: none`).

Re-run after the fixes: **156 files, 37 flagged (1 critical / 47)** —
the single critical is the defended pulse transition. New permanent
probe `scripts/probe-categories.mjs` **9/9** (create → arm → cancel →
re-arm → confirm-delete; self-cleaning).

## Endgame — step 3: `/finalize` ✅ DONE (findings-only run)
Gate state at run: tsc 0 · eslint 0 · build 0 · smoke 84/84 ·
probe-going 10/10 · probe-scan 5/5 · probe-audit 11/11 ·
probe-categories 9/9 · detector 156 files / 37 flagged (1 crit / 47 warn,
all triaged).

- **Verdict: NOT READY — one Major** (zero Critical after the documented
  downgrades): **Arabic inherits Latin letter-spacing.** `h1–h3`
  (-0.02em), `.display-hero` (-0.035em), chapter/detail titles
  (-0.03em) all apply to RTL text — the Arabic block (globals.css:52)
  swaps font-family and weight but never resets tracking — and
  PulseScreen adds `tracking-[0.2/0.3/0.35em]` on dict strings that
  render Arabic in AR. Violates finish-bar Pass 2 ("never adjust
  Arabic spacing") and brief principle 4. Fix = one RTL letter-spacing
  neutralization guard (+ scope the pulse labels); not applied —
  finalize is findings-only.
- Detector's 1 critical (`transition-[width]` on the live pulse)
  downgraded to **Deferred per brief** — serves principle 3 ("Alive or
  silent"), motion knob 9; scaleX would corrupt the rounded caps;
  killed under prefers-reduced-motion (globals.css:402).
- Minors accepted in writing: `color-scheme` never declared (one-line
  viewport fix; auto-dark risk on Android); org.empty / oins.empty
  offer no next step where one exists; motion/space/z ride Tailwind
  defaults (recommend `/tokens` named eases for a MOTION-9 surface);
  47 detector warnings all defended (see step 2 entry).
- Passes otherwise green: hierarchy, surface stack (semantic names,
  dark deferred per brief §5), spacing rhythm, iconography (no emoji,
  one stroke family), microcopy (dict-owned, no generic CTAs), pixel
  honesty (role-based radii, hairline/structural border pairing),
  data formatting (tabular-nums ×19, locale-aware dates).

## Endgame — step 4: Major fixed (RTL letter-spacing) ✅ DONE
One unlayered guard in `globals.css` (after `.display-figure`): branches
for `h1/h2/h3` + `.display-hero`/`.display-chapter`/`.display-title`
(equal specificity, placed later → they win **in RTL only**) plus a `*`
branch that beats Tailwind's `tracking-*` utilities — unlayered rules
win over `@layer utilities` regardless of specificity (the same
precedence the component layer above depends on). `.display-figure` is
deliberately excluded: it renders Latin tabular numerals, whose tight
display tracking is numeral typography, not an Arabic adjustment. The
`*` branch also future-proofs: no new `tracking-[…]` on a dict string
can reach Arabic again. OG cards stay French-only by design
(`og.tsx` hardcodes `fr["meta.description"]`) — no Arabic in images.

- Verification (temp CDP script, deleted after the run): 8/8 — LTR
  keeps `-4.0656px` hero / `-1px` utility; AR flips `dir=rtl` and
  computes `normal` on `.display-hero`, `.display-chapter` and the
  `tracking-tight` utility; `.display-figure` still `-11.776px` in AR.
- Gates: tsc 0 · eslint 0 · build 0 · smoke 84/84 · probe-going 10/10
  (incl. its own Arabic flip) · probe-pulse 7/7 · detector re-run
  156 files / 37 flagged — **identical** to the defended step-2 count
  (same 1 crit = the Deferred `transition-[width]`), zero new findings
  from the guard.
- **Verdict change: NOT READY → no Critical/Major outstanding** (Minors
  accepted in writing at step 3; detector's 1 critical remains Deferred
  per brief). Remaining endgame: honest UICraftScore + Lighthouse
  mobile ≥ 70 per page.

## Endgame — step 5: Lighthouse mobile ≥ 70 per page ✅ DONE
First pass put `/events` **below gate (perf 64)**; the other four
cleared (landing 78 · detail 82 · clubs 94 · login 90). Diagnosis +
fix:

- **Root cause (LCP 3777ms vs FCP 1076ms):** EventsExplorer's mount
  `gsap.from(bands, {opacity: 0})` re-hid the SSR-painted ink header
  only after hydration — on a throttled phone the LCP headline
  re-qualified only when the tween showed it again. **Fix:** the band
  entrance moved to CSS (`cp-band-rise` keyframes + `[data-band]`,
  globals.css) so it plays from the FIRST paint — same choreography
  (y40 → 0, opacity 0 → 1, 0.55s, stagger via inline delays 0.05s /
  0.12s), `backwards` fill holds the start state, the global
  reduced-motion block collapses it, and fill reverts leaving no
  transform for Flip to read. The poster tween keeps gsap but now
  **skips elements already inside the viewport** (nothing the user has
  seen may blink out). LCP observer traces: unthrottled LCP
  3777 → **1048ms**; residual throttled LCP (≈3.2s) is the font swap
  (woff2 lands ≈1.6s under 1.6Mbps) — recorded as headroom, not
  gating. Note: `landing`, whose LCP = FCP, proves the pattern.
- **Smoke blip investigated, not a regression:** "No band on a live
  event" failed after the seed aged out — `seed-event-line-follower`
  was seeded Oct 30 (`daysFromNow(3)`) and its window ended Nov 2,
  between gate runs. `npm run db:seed` refreshed the relative windows
  → 84/84 restored.
- Gates after the change: tsc 0 · eslint 0 · build 0 · smoke 84/84 ·
  probe-map 11/11 · probe-search 17/17 (both drive EventsExplorer,
  incl. the Flip filter path) · detector **156 / 37 — unchanged**
  (same 1 deferred crit).
- **Lighthouse mobile, two passes (all categories ≥ 70 both times):**

  | page | pass 1 | pass 2 | a11y | bp | seo |
  |---|---|---|---|---|---|
  | landing | 95 | 85 | 100 | 100 | 100 |
  | events | 83 | 85 | 98 | 100 | 100 |
  | event-detail | 91 | 76 | 100 | 100 | 90 |
  | clubs | 95 | 92 | 100 | 100 | 100 |
  | login | 89 | 97 | 100 | 100 | 100 |

- Known follow-up (passes, not gating): event-detail's LCP swings
  896 ↔ 3211ms — `Entrance.tsx` has the same post-paint `gsap.from`
  re-hide; the seen-elements rule from EventsExplorer would stabilize
  it. Also: `/events` a11y 98 = `heading-order` (h1 → h3, cards skip
  h2) — closed ✅, see "Follow-ups" at the end.

## Endgame — step 6: honest score ✅ DONE (judged — deterministic tool absent)
The deterministic UICraftScore tooling is **not installed in this
environment** (`eval.mjs` / `score_ui` / `evals/quality/score.mjs` —
none present; only `ui-craft-detect` ships here). Reported honestly
rather than fabricated: ran the documented judged companion
(`heuristic` skill, rubric `references/heuristics.md`, labeled
**(judged)** — never gates CI).

- **UsabilityScore: 70 / C (judged)** — Nielsen mean 4.0 (all ten at
  4) → base 75 − 5 (one failed law) = 70.
- **Design laws: 5 PASS / 1 FAIL** — Fitts FAIL: map pins are 16px
  touch targets (EventsMap `h-4 w-4` span, no hit-area expansion)
  vs the 44px mobile floor; mitigations: map is a secondary view,
  full-size cards in grid, pins carry aria-label + aria-pressed.
- **Top findings (ranked):** (1) Fitts — 16px map pins (adds-friction);
  (2) filter/view state not in the URL — Back from a detail resets
  the events wall (adds-friction); (3) `Entrance.tsx` post-paint
  re-hide on detail/clubs — content blinks after paint, LCP swings
  896↔3211ms (reduces-trust; fix pattern proven on `/events`).
- Deterministic counterpart can replace this the moment the ui-craft
  eval package is installed (`node scripts/eval.mjs <path> --json`);
  the two are never averaged.

## Endgame — COMPLETE
All six steps done: logo ✅ · detector ✅ · finalize ✅ (NOT READY →
Major fixed) · RTL guard ✅ · Lighthouse mobile ≥70/page ✅ (two
passes) · honest score ✅ (70/C judged). Standing next: commit on
explicit instruction; CI runs on first push.

## Next — agreed order
Endgame: ~~SVG logo pick~~ ✅ → ~~`npx ui-craft-detect ./src`~~ ✅ →
~~`/finalize`~~ ✅ (NOT READY — 1 Major: RTL letter-spacing) →
~~fix the Major~~ ✅ → honest UICraftScore + Lighthouse mobile ≥ 70 per page.

## Throughout — credibility layer
E2E on the critical path (RSVP transaction, waitlist promotion, QR check-in),
GitHub Actions CI, rate limiting on auth/RSVP, audit log.

## Feature ✅ — choose-role gate `/choose` (student or event organizer?)
- After every non-admin sign-in the app asks "Student or event
  organizer?" before choosing a home. `postLoginPath()`: ADMIN → `/admin`,
  everyone else → `/choose`; `registerAction` lands there too; a
  middleware `from` return-trip still wins (a bounced `/dashboard` or
  saved-event visit goes straight back). `/choose` joined `needsAuth` +
  the matcher — anonymous visits bounce to `/login?from=%2Fchoose`.
- The organizer card runs `chooseRoleAction`: STUDENT → ORGANIZER (prisma
  update + `recordAudit` `user.self_promoted_organizer` `{via:"choose"}` +
  `unstable_update({ user: { role } })` + redirect `/organizer`). The jwt
  callback's new `trigger === "update"` branch writes the role into the
  token — edge middleware reads ONLY the JWT, so without that re-sign the
  caller would be bounced off the very console it was just granted
  (probe-choose exists for exactly that regression). Real event power
  still needs an admin-curated `ClubMember`: the no-club console keeps
  its honest "Ask an admin…" state, so the grant only opens the console.
  Student card = plain link to `/dashboard` (no demotion); existing
  organizers route without a second promotion; admins never see the page.
- Page: headline on the page grid (wordmark's left edge) over a pair of
  colour fields — surface (student) / ink (organizer) — display-chapter
  h1 → h2 ×2, forward-arrow CTAs (`rtl:-scale-x-100`, direction-neutral
  `group-hover:underline`), no entrance motion (utility gate). Copy
  net-new: `auth.choose.*` ×3 locales + audit label ×3.
- `scripts/probe-choose.mjs` **14/14** (permanent; throwaway account
  registered through the real form each run, user + audit rows deleted
  after): anon bounce with `from`, register → `/choose`, FR content,
  promotion → session role + DB role + audit row, `/organizer` entered on
  the fresh JWT (never bounced to `/dashboard`), honest no-club console,
  student routing, AR `dir=rtl` + AR title, admin skip, organizer
  every-login, `from=/dashboard` bypass. En route fix: the session
  cookie outlived `Network.clearBrowserCookies` once — the helper now
  deletes cookies by name.
- Seed contract fixed (found by probe-going after the DB wipe): the
  poster event's going-block promises three confirmed RSVPs, but the
  committed seed only ever wrote Salma's — the FR three-name line was
  living on probe residue (`door-probe-omar`). `prisma/seed.ts` now
  writes the trio (Salma / Omar / Admin) with staggered `createdAt`, so
  the order — and the line — survive every re-seed. probe-going back to
  **10/10** standalone.
- Gates: tsc 0 · eslint 0 · build 0 (`/choose` 179 B) · smoke **84/84** ·
  probe-choose **14/14** · login-driving regressions: audit **11/11** ·
  camera **8/8** · categories **9/9** · door **12/12** · going **10/10** ·
  offline **7/7** · pass **16/16** · scan **5/5** · wallet **15/15** ·
  detector **0 new FAIL** (touched files clean; the repo-wide 61 FAIL
  are pre-existing asset/offline/insights/emoji findings) · Lighthouse
  `/choose` (mobile, authed via Cookie extra-header) **93 / 100 / 100 /
  100**, FCP = LCP 905 ms.
- Copy follow-up pending approval (existing-page copy change): the
  register sub line — "Everyone starts as a student. Clubs promote
  organizers." / FR / AR — is stale now that the choice page grants the
  organizer role. Proposed: "Everyone starts as a student. Pick
  organizer from your next login." (FR/AR to match). Left untouched
  pending sign-off.

## Feature ✅ — creator traffic console `/creator`
- The creator gets a door of their own: `CREATOR_LOGIN` /
  `CREATOR_PASSWORD` in `.env` (gitignored; placeholders + instructions
  in `.env.example` — change them there) instead of a `User` row, a
  role, or any NextAuth surface. Both halves compare as SHA-256
  digests (constant-time) and the action signs `cp-creator` =
  `${exp}.${HMAC-SHA256("cp-creator:${exp}")}` — 7d, httpOnly, lax,
  pure Web Crypto, fail-closed without a ≥16-char key
  (`CREATOR_SESSION_SECRET`, else `AUTH_SECRET`). Attempts reuse
  `loginLimiter` keyed `creator:<login>` (8/10 min — the same NAT
  reasoning as the app login).
- Guard = route-group layout `src/app/creator/(console)/layout.tsx`
  (cookie verify → `/creator/login`, `robots: noindex`); the login
  lives outside the group. Deliberately NOT middleware — the creator
  session is not a NextAuth session, so the feature-held
  `middleware.ts` and its JWT matcher stay untouched. Wrong password
  keeps you on the door with an honest alert; a valid cookie skips the
  door entirely.
- Collector: `ViewReporter` in the root layout beacons
  `POST /api/traffic` per navigation (fire-and-forget keepalive,
  Strict-Mode `lastSent` dedupe, skips `/creator*` — the console never
  counts itself; visitorId = first-party `cp-visitor` in localStorage
  with a per-load fallback; referrer = previous path / same-origin
  path / external URL). The route validates (path starts `/`, not
  `//`, not `/api/`; visitorId `^[A-Za-z0-9-]{8,64}$`),
  `trafficLimiter` 60/10min per visitor, stores raw UA parsed at read
  time (`src/lib/traffic.ts`). Honest scope: a row = "a real browser
  rendered this page" — no JS, no row.
- Prisma `PageView` (path, referrer?, visitorId, userAgent?,
  createdAt; indexes `[createdAt]`, `[path, createdAt]`), migration
  `20261104223333_creator_traffic` applied.
- Dashboard `/creator`: ink header band + Refresh (plain
  `<a href="/creator">` — a real reload, so the numbers are always the
  server's latest read) + sign-out server action; four stat cards
  (24h / 7d / 7d visitors / all-time) as plain
  `text-[32px] font-display font-extrabold tabular-nums` — NOT
  `.display-figure`, which is an unlayered 150–380px landing figure;
  14-campus-day area chart (flat `fill-accent/15`,
  `vector-effect=non-scaling-stroke`, aria-hidden, campus-noon anchored
  buckets via `campusDayLimit(-13)`); top paths / referrers / devices
  tables with horizontal accent share bars; recent-20 table; `.empty`
  zero state. One 14-day query + one all-time count, all groupings in
  JS. Copy net-new `src/i18n/dict/creator.ts` ×3 locales (merged in
  `i18n/index.ts`).
- `scripts/probe-creator.mjs` **13/13** (permanent; deletes its own
  PageView rows on the way out): reporter row for a real `/events`
  render · anon bounce · wrong-password alert · real creds → dashboard
  (h1 "Traffic", four stats, `/events` visible in the tables) · login
  door skips when signed in · **session separation** — `cp-creator`
  opens no NextAuth door (`/admin` still demands login) · logout drops
  the cookie and a fresh anon visit bounces again · AR `dir=rtl` + AR
  title · collector validation (`javascript:`, `//host`, missing
  visitorId → 400; well-formed → 200) · zero `/creator*` rows ever.
- Gates: tsc 0 · eslint 0 · build 0 (`/creator` 185 B,
  `/creator/login` 1.23 kB) · smoke **84/84** (on the final build) ·
  detector **0 FAIL / 0 WARN** on all 10 new files · probe-creator
  **13/13** · Lighthouse mobile — `/creator/login` **80 / 100 / 100 /
  60** (LCP 1.1 s), `/creator` authed via Cookie extra-header **98 /
  100 / 100 / 60** (LCP 1.0 s) [perf / a11y / bp / seo].
- SEO 60 is the one deliberate gate exception, not a defect: the sole
  failing audit is `is-crawlable` (weight 4.04) — both pages carry
  the `robots: noindex` a private console must have, and the category
  cannot pass while noindex stands. Every crawl-quality audit (title,
  meta description, link text, anchors, hreflang) passes at 100;
  dropping noindex to chase the number would advertise the creator
  door to search engines.

## Follow-ups ✅ — the three picked tails, closed

### 1. `/events` a11y 98 → 100 (`heading-order`)
- Cause: the card wall sits directly under the page `h1` while every
  `EventCard` title was a hardcoded `h3` — the outline read
  `h1 → h3 ×5` (cards skip h2).
- Fix: `EventCard headingLevel?: 2 | 3` (default 3) renders a dynamic
  `Title` tag. Grid wall and map panel pass 2 (nothing sits between h1
  and the cards); calendar (day `h2` already above) and the club page
  (section `h2`s above) keep 3. EventsMap's off-map list heading went
  `h3` → `h2` too: it is the only section below the h1 when no card is
  selected.
- Probes that pinned the tag (`probe-map.mjs:43`, `probe-geo.mjs:30`)
  now select `[data-flip-id] :is(h2,h3)` — level-agnostic.
- Verified: rendered `/events` outline `h1 h2 h2 h2 h2 h2`; Lighthouse
  13.6.0 `/events` **a11y 100** with `heading-order` score 1 (was
  score 0 / category 98), bp 100, seo 100.

### 2. Em-dash copy: 51 → 0 on the gate scope
- The gate's scope, reconstructed: the 21 files touched since
  `a5774ee` produce exactly `51 em dashes` (one aggregate WARN, the
  detector only fires above 4). The round scope adds the four touched
  components + `prisma.config.ts` → 26 files, 55 counted.
- Per file (counted, comments stripped): `prisma/seed.ts` **41** ·
  `dict/admin.ts` **6** (reject placeholder + audit lead ×3 locales) ·
  `dict/auth.ts` **3** (`choose.sub` ×3 locales) ·
  `creator/(console)/page.tsx` **1** (JSX comment) · `EventCard.tsx`
  **3** (comments) · `PostEventThanks.tsx` **1** (→ `·`).
- Tactics: prose got real punctuation (full stops / colons); labels,
  titles and venues got ` - ` (seed's `VENUE_COORDS` keys and every
  `location` value swapped together, so campus ordering still
  matches); seed re-seeded through the config's `migrations.seed`.
- Two pre-existing findings that widening the scope exposed were fixed,
  not defended: EventsMap `divide-y` hairline FAIL → `space-y-1`;
  EventsExplorer `min-h-screen` WARN → `min-h-dvh`.
- Verified: detector **0 FAIL / 0 WARN** on the 26-file scope; no probe
  or smoke assertion pins an em-dash (probe-audit's verbatim JOINED
  string lives in `dict/detail.ts`, untouched).
- Standing, out of scope: 155 counted em-dashes remain in 36 files the
  gate never scans (`dict/detail.ts` JOINED, `events/[id]`, both
  `opengraph-image.tsx`, other dicts). A full-app sweep is its own
  pass — this tail only closed the gate scope.

### 3. `package.json#prisma` → `prisma.config.ts`
- The deprecated `prisma` block is gone from `package.json`;
  `prisma.config.ts` carries `defineConfig({ schema, migrations: {
  seed: "tsx prisma/seed.ts" } })`.
- Gotcha: with a config file present the CLI skips `.env` auto-loading
  ("Prisma config detected, skipping environment variable loading")
  and died with `P1012 Environment variable not found: DIRECT_URL`.
  The config now loads `.env` itself — zero-dep KEY=VALUE parser (`#`
  comments, quotes), real environment variables always win (CI),
  missing file tolerated (fresh clone).
- Verified: `prisma generate` 0 with the deprecation warning gone ·
  `migrate status` 0 (8 migrations, up to date) · `npx prisma db seed`
  0 through `migrations.seed` (new copy in the DB).

### Gates (whole round)
tsc 0 · eslint 0 · build 0 · smoke **84/84** · detector **0 FAIL /
0 WARN** (26 files; was 51 em dashes) · probe-choose **14/14** ·
probe-creator **13/13** · probe-map **11/11** · probe-geo **10/10** ·
probe-search **17/17** · probe-audit **11/11** · probe-feedback
**14/14** · Lighthouse `/events` **100 a11y / 100 bp / 100 seo** with
`heading-order` score 1. Perf 62 → 54 on back-to-back runs is load
noise: TTFB 90–120 ms, TBT swinging 1110 ↔ 3280 ms while Spotify and
Opera share the 5 logical cores (calm runs measured 83/85).
- Build note: two identical `npm run build` crashes inside webpack's
  `WasmHash._updateWithBuffer`, before any app code compiled — stale
  `.next/cache` from the interrupted session. `Remove-Item .next` +
  rebuild green (24/24 static pages).
