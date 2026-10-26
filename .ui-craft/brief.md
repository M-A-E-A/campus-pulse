# Campus Pulse — Design Brief

*Created 2026-10-24 via /brief. Binding for every future UI session on this repo.*

## 1. Product purpose

Campus Pulse is the trilingual (AR/FR/EN) event platform for EMSI: student clubs publish
events, students discover them, RSVP, and enter campus events with rotating QR tickets.

## 2. Primary user

- **Primary:** EMSI students, 18–26, mobile-first, moving between Arabic, French and English,
  discovering events from hallway posters, Instagram stories and WhatsApp forwards — often
  between classes, often at the last minute.
- **Secondary:** club organizers publishing events, running door check-in and rosters.
- **Tertiary:** admins approving events, managing clubs/categories, reading insights.

## 3. Principles

1. **Events are posters first.** The screen should feel like the hallway wall — loud, immediate,
   scannable in one glance.
2. **The ticket is the product.** RSVP → QR → door scan is the spine; every visual serves that
   moment.
3. **Alive or silent.** What is happening now (pulse, seats left, live counts) is shown real,
   never faked.
4. **Three scripts, one design.** Arabic, French and English are first-class; RTL mirrors the
   composition, it never degrades it.
5. **Calm where people work.** Forms, dashboards and the QR scanner stay quiet, fast and obvious.
   The wildness lives on discovery pages (landing, event listing, event detail).

## 4. Success metric

A student on a phone goes from landing to a held QR ticket in under 60 seconds without asking
anyone; an organizer runs door check-in with no training.

## 5. Out of scope

- No social features (no comments, DMs, feeds) — events and tickets only.
- No payments — campus events are free; capacity and waitlists only.
- No native mobile app — the web app is the product.
- No CMS — the landing is code; all content comes from the events database.
- No dark-mode toggle — the chapter palette *is* the design.

## 6. Learned constraints (dated, binding)

### 2026-10-24 — Radical redesign engagement (user instruction)

- **Approved direction:** `colour-chapters` (taste-skill seed 2136379154). The page is a wall of
  full-bleed colour posters; each section is a chapter with its own flat field. Idea sentence:
  "the paper event poster that already covers EMSI's hallways becomes the page itself."
- **Palette:** dealt proportions, colours taken from the subject — ink `#14130f`, paper `#faf7f2`,
  signal orange `#ff4d00` (+ accent-dark `#c93b00` / deep `#a83000` / soft `#fff0e6`). No new
  hues. AA verified: ink↔orange 5.57:1, accent-dark↔paper 4.82:1; paper↔orange is display-only.
- **Type:** Cabinet Grotesk (self-hosted woff2), display 800 / body 400–500; Arabic swaps to
  IBM Plex Sans Arabic 600/700. One family, two roles, no eyebrows, no uppercase labels.
- **Bans (verbatim):** purple or indigo gradients, Inter everywhere, gradient text,
  glassmorphism nav, centered hero with two buttons, three identical feature cards, uniform
  rounded corners, emoji icons, bounce easing, background blobs, hover:scale on cards, hype copy
  ("supercharge", "seamless", "unlock").
- **Guardrails:** wild on landing/discovery; calm+fast on forms/dashboards/scanner. Core flow
  (find event → RSVP → QR ticket → check in) stays obvious. `prefers-reduced-motion`, keyboard
  access, AA contrast, correct RTL on every page. Three.js client-only, lazy, pixel-ratio capped,
  static fallback. Lenis drives ScrollTrigger from `gsap.ticker`. Mobile Lighthouse ≥ 70.
- **Phase 1 preserve (never break):** routes/URLs, data fetching, forms and validation, auth and
  role checks, the RSVP transaction, QR check-in, API routes, database code. Copy changes only
  with explicit per-page approval (new display headlines are presented before they ship).
- **Knobs:** DESIGN_VARIANCE 10, MOTION_INTENSITY 9, CRAFT_LEVEL 9, VISUAL_DENSITY 4 public /
  6 dashboards. GSAP + Lenis + Three.js opted in.
- **Scope order:** rebuild landing, events list, event detail; reskin dashboards, admin, auth.
  One page at a time, user feedback between pages, max 3 review rounds per page.
