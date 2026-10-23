# Campus Pulse — EMSI

One university, one place for club events. Clubs post events, students find them, RSVP, get a QR ticket, and organizers scan them at the door. Built with Next.js (App Router), TypeScript, Tailwind, Prisma + PostgreSQL, Auth.js, GSAP, Lenis, and React Three Fiber.

Built as a pitch for **EMSI** (École Marocaine des Sciences de l'Ingénieur): real contact details, campus address, socials and official links in the footer; the six EMSI formations as event categories; real campus clubs (Club Innovation, Enactus, BDE, GDSC, Hult Prize, JLM…) in the seed; and real event material (ETH hackathon, ERC robotics). The whole UI is **trilingual (FR / EN / AR)** with a language switcher in the nav — Arabic renders full RTL with an Arabic typeface.

## The core flow (demo this end to end)

1. Organizer creates an event (draft).
2. Organizer submits it → admin approves it (or rejects with a reason).
3. It appears on `/events`.
4. Student RSVPs → gets a ticket with a QR code.
5. Organizer scans the QR at the door → student marked attended.
6. Organizer sees RSVPs vs. actual attendance, exports CSV.

## Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL + DIRECT_URL from your Neon dashboard.
# Generate AUTH_SECRET: openssl rand -base64 32

# 3. Create tables
npm run db:migrate

# 4. Seed demo data (accounts, clubs, events)
npm run db:seed

# 5. Run — production build (what you demo with; ~3-8× faster than dev)
npm run build
npm start          # serves on http://localhost:3100

# or run the dev server (stop `npm start` first — same port)
npm run dev
```

> Local database: `node scripts/start-db.mjs` starts an embedded PostgreSQL
> on port 5433 (data in the temp dir) if you're not using Neon. `.env` must
> point `DATABASE_URL`/`DIRECT_URL` at whichever you chose.

### Demo accounts (password: `password123`)

| Email | Role |
| --- | --- |
| `admin@campus.ma` | Admin — approval queue, clubs, categories |
| `organiser@campus.ma` | Organizer — create events, attendee list, check-in |
| `student@campus.ma` | Student — RSVP, tickets, dashboard |

## What to look at in the defense

- **RSVP race condition** (`src/lib/actions/rsvp.ts`): the capacity check and the insert run in one transaction, with `SELECT … FOR UPDATE` on the event row so two students racing for the last spot can't oversell. The unique constraint on `(userId, eventId)` is the second line of defense.
- **Idempotent check-in** (`src/lib/actions/checkin.ts`): the update only fires while `checkedInAt IS NULL`, so rescanning the same ticket returns "already checked in" instead of double-counting.
- **Server-side authorization** (`src/lib/auth.ts`, `src/middleware.ts`): UI role checks are cosmetic; every server action and route re-checks role and club membership.
- **Time zones** (`src/lib/tz.ts`): everything is stored in UTC, displayed in the campus zone (default `Africa/Casablanca`). The seeded "Pitch de minuit" event crosses midnight on purpose.
- **Three.js discipline** (`src/components/landing/`): the canvas loads client-only via `dynamic` + `ssr: false`, pixel ratio is capped, and it never loads on reduced-motion or weak devices — the hero falls back to a static gradient.
- **Lenis + ScrollTrigger** (`src/components/landing/SmoothScroll.tsx`): they share one clock — Lenis renders from `gsap.ticker`, and its scroll event drives `ScrollTrigger.update`.
- **Shared data cache** (`src/lib/queries.ts`): the public catalogue (events list, landing strip) is cached for 60s with `unstable_cache` and tagged `"events"`; every mutation (RSVP, approval, cancellation, category edit) calls `revalidateTag`, so N visitors share one database query and the lists are never stale after an action. Pages stay dynamic per-user — only the DB work is shared.
- **Bundle discipline**: `html5-qrcode` (~109 kB) loads only when "Start camera" is clicked; `qrcode` (~18 kB) loads only when a ticket is on screen; Three.js only on the landing hero. Covers go through `next/image` (Cloudinary). Measured: `/` 1133 ms dev → 131 ms prod (warm).
- **Auth.js in production**: `trustHost: true` in `src/auth.config.ts` — Auth.js only auto-trusts the host in dev, so without it every login 500s under `next start`.
- **Trilingual UI (FR/EN/AR)** (`src/i18n/`): one flat dictionary per language merged from namespace files; `fr`/`ar` are typed as `Record<keyof typeof en, string>` so a missing translation is a **compile error**. Locale = `cp-locale` cookie, falling back to `Accept-Language` (then `en` for plain HTTP clients, which keeps the smoke tests deterministic). Server components use `getT()`, client components `useT()`; only the active language is serialized into the page. Arabic flips `dir="rtl"` at the root and swaps to an Arabic typeface. Zod messages are dictionary keys translated by `firstZodMessage()`.
- **EMSI content** (`prisma/seed.ts`, `src/app/page.tsx`): the six formations are the event categories, clubs and events mirror real campus life (ETH, ERC, BDE, Enactus), and the footer carries the real Roudani address, phone, email and socials from emsi.ma.

## Innovation pack

Five additions that make the platform more than a CRUD demo:

- **🫀 Live Pulse** (`src/app/api/events/[id]/pulse/route.ts`, `/organizer/events/[id]/pulse`): an SSE endpoint streams `{total, checkedIn, capacity, recent}` every 2.5 s (emitted only on change, heartbeat every 15 s) to a projector-friendly full-screen door display. Scan a QR on stage and the counter ticks live — the pitch centerpiece. The GSAP count-up lives on this presentation surface only; dashboards remain animation-free.
- **🪑 Waitlist with automatic promotion** (`src/lib/rsvp-core.ts`): a full event queues the student as `WAITLISTED` instead of failing; cancelling a confirmed seat promotes the earliest queued student inside the same `FOR UPDATE` transaction (keeping their ticket code, so their QR appears on the dashboard immediately). The badge shows queue position (1 = next in line), and waitlisted codes are refused at the door with their own message.
- **🎫 Rotating anti-screenshot QR** (`src/lib/ticket-sign.ts`): the ticket QR encodes `code|bucket|hmac` — an HMAC bound to a 60-second slot (±2 slots of clock skew), key derived from `AUTH_SECRET`. A screenshot of yesterday's QR fails at the door; manual code entry (what the tests use) still works.
- **📅 Secret ICS calendar feed** (`/api/calendar/[token]`, `src/lib/ics.ts`): one unguessable 192-bit link subscribes Google/Apple/Outlook to every upcoming RSVP; "Regenerate" rotates the token and kills every old link. The feed deliberately omits ticket codes — calendars sync to lock screens.
- **📊 Campus insights heatmap** (`/admin/insights`): 7 days × 12 two-hour slots of campus-local check-in history from the seeded past semester (14 past events, 33 check-ins), with stats and a peak line — currently **Wed 18:00–20:00** — for the school's scheduling decisions.

## Project map

```
src/
  app/
    page.tsx                  Landing (hero, pinned steps, upcoming strip)
    events/                   Search/filter page (GSAP Flip on filter) + event page
    dashboard/                Student: upcoming, saved, past
    organizer/                Event list, form, attendees + CSV, check-in scanner, live pulse
    admin/                    Approval queue, clubs, categories, insights heatmap
    api/events/[id]/          ticket JSON, attendees CSV, calendar (.ics), pulse (SSE)
    api/calendar/[token]/     Personal ICS subscription feed (secret token)
    api/tickets/[rsvpId]/qr   Mint a signed rotating QR payload
  components/
    landing/                  Hero (Three.js), HowItWorks (GSAP pin), EmsiStrip, SmoothScroll (Lenis)
    events/                   EventCard, EventsExplorer (Flip), RsvpSection, Ticket
    organizer/                EventForm, CheckInScanner (html5-qrcode, lazy)
    ui/                       Skeleton (loading.tsx files use it)
    MobileNav.tsx             Responsive menu (server-aware, client toggle)
    LanguageSwitcher.tsx      FR / EN / AR pills (cookie + full-tree revalidate)
  i18n/
    core.ts                   Locale primitives (client-safe, no data)
    index.ts                  Dictionary merge + key types
    server.ts                 getLocale/getT + firstZodMessage
    provider.tsx              Client context: useT / useLocale
    dict/                     One namespace file per area, 3 languages each
  lib/
    actions/                  Server actions (all mutations, cache revalidation)
    auth.ts                   Auth.js + role helpers
    queries.ts                Shared cached catalogue data (tag: "events")
    tz.ts                     UTC → campus time zone
    storage.ts                Cloudinary upload (local fallback without keys)
    validation.ts             Zod schemas for every form/request
prisma/
  schema.prisma               Data model
  seed.ts                     Demo data
```

## Intentionally cut

3D campus map, chat, payments, native apps, AI search — each is its own project. (Multilingual AR/FR/EN was optional too and **is** implemented — see `src/i18n/`, and the optional waitlist add-on **is** implemented — see the Innovation pack above.)
