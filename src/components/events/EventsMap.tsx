"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/i18n/provider";
import { CAMPUSES, distanceKm, formatKm, type GeoPos } from "@/lib/geo";
import { EventCard, type EventCardData } from "./EventCard";

/**
 * The campus map view (Phase 10). Hand-drawn SVG, no tiles and no API keys:
 * every pin is projected from the event's own `lat`/`lng` onto the same
 * padded bounding box that frames both campus centres.
 *
 * The drawing lives in a fixed internal grid (`VB_W` × `VB_H`) while the SVG
 * stretches to whatever shape the container takes
 * (`preserveAspectRatio="none"`). Pins are real HTML buttons positioned at
 * the very same normalised coordinates, so a stretched frame can distort the
 * shapes but can never make a pin drift off its venue — and buttons keep the
 * focus ring, the 16 px target and the translated `aria-label` that an SVG
 * `<a>` would have to reinvent.
 */

/** Internal drawing grid. The container's aspect may differ (see above). */
const VB_W = 1000;
const VB_H = 700;

/** ~660 m of latitude, so a lone venue still gets a readable frame. */
const MIN_LAT_SPAN = 0.006;
/** Margin around the fitted data — 1.1 = 5 % per side, both axes at once. */
const PAD = 1.1;

/** Campus "zone" blocks, in drawing units (schematic, not surveyed). */
const ZONE_W = 260;
const ZONE_H = 190;
/** Radius of the fan that separates pins sharing one venue, in px. */
const FAN_R = 20;
/** Metres per degree of latitude — good to ~0.1 % at any map scale. */
const KM_PER_DEG = 111.32;

type Box = {
  latMin: number;
  lngMin: number;
  latMid: number;
  kx: number;
  xSpan: number;
  ySpan: number;
  /** Project a coordinate to normalised 0–1 field coordinates. */
  at: (p: GeoPos) => { nx: number; ny: number };
};

/**
 * Fit every anchor (campus centres + event venues) into the drawing grid:
 * widen the deficient axis to the grid's aspect, then pad both axes by the
 * same factor so the aspect survives. Longitude is compressed by cos(lat)
 * first — at Casablanca's latitude a degree of longitude is ~83 % of a
 * degree of latitude, and skipping that is what makes naive maps look
 * squashed.
 */
function fitBox(points: GeoPos[]): Box {
  let latMin = Math.min(...points.map((p) => p.lat));
  let latMax = Math.max(...points.map((p) => p.lat));
  let lngMin = Math.min(...points.map((p) => p.lng));
  let lngMax = Math.max(...points.map((p) => p.lng));

  // A single venue (or a tight cluster) still deserves a frame.
  if (latMax - latMin < MIN_LAT_SPAN) {
    const c = (latMin + latMax) / 2;
    latMin = c - MIN_LAT_SPAN / 2;
    latMax = c + MIN_LAT_SPAN / 2;
  }
  let kx = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
  if ((lngMax - lngMin) * kx < MIN_LAT_SPAN) {
    const c = (lngMin + lngMax) / 2;
    const half = MIN_LAT_SPAN / (2 * kx);
    lngMin = c - half;
    lngMax = c + half;
  }

  const latMid = (latMin + latMax) / 2;
  kx = Math.cos((latMid * Math.PI) / 180);
  let xSpan = (lngMax - lngMin) * kx;
  let ySpan = latMax - latMin;

  const aspect = VB_W / VB_H;
  if (xSpan / ySpan < aspect) {
    const half = (ySpan * aspect - xSpan) / (2 * kx);
    lngMin -= half;
    lngMax += half;
    xSpan = ySpan * aspect;
  } else {
    const half = (xSpan / aspect - ySpan) / 2;
    latMin -= half;
    latMax += half;
    ySpan = xSpan / aspect;
  }

  // Margin, both axes by the same factor — the aspect survives the padding.
  const half = (PAD - 1) / 2;
  lngMin -= (xSpan * half) / kx;
  lngMax += (xSpan * half) / kx;
  xSpan *= PAD;
  latMin -= ySpan * half;
  latMax += ySpan * half;
  ySpan *= PAD;

  return {
    latMin,
    lngMin,
    latMid,
    kx,
    xSpan,
    ySpan,
    at: (p) => ({
      nx: ((p.lng - lngMin) * kx) / xSpan,
      ny: (latMax - p.lat) / ySpan,
    }),
  };
}

export function EventsMap({
  events,
  slots,
  pos,
}: {
  events: EventCardData[];
  /** The dealt poster slots, so the selected card keeps the tone it has on
   *  the wall (see EventsExplorer — filters never re-deal the hand). */
  slots: Map<string, number>;
  /** The viewer's position, only ever set after they asked for "Near me". */
  pos: GeoPos | null;
}) {
  const t = useT();
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Both campuses are always anchors: the frame shows the campus map even
  // when every visible event sits on one of them.
  const box = useMemo(() => {
    const anchors: GeoPos[] = [
      ...CAMPUSES.map((c) => ({ lat: c.lat, lng: c.lng })),
      ...events.flatMap((e) =>
        e.lat !== null && e.lng !== null ? [{ lat: e.lat, lng: e.lng }] : []
      ),
    ];
    return fitBox(anchors);
  }, [events]);

  // One pin per venue; events that share a venue fan out on a small arc
  // above it, so every pin stays individually clickable.
  const pins = useMemo(() => {
    const groups = new Map<string, EventCardData[]>();
    for (const e of events) {
      if (e.lat === null || e.lng === null) continue;
      const key = `${e.lat}|${e.lng}`;
      const group = groups.get(key);
      if (group) group.push(e);
      else groups.set(key, [e]);
    }
    const out: Array<{
      e: EventCardData;
      nx: number;
      ny: number;
      dx: number;
      dy: number;
    }> = [];
    for (const group of groups.values()) {
      group.forEach((e, i) => {
        const { nx, ny } = box.at({ lat: e.lat as number, lng: e.lng as number });
        // Angle sweeps −150°…−30°: the fan bulges upward, away from labels.
        const angle = ((-150 + (120 * i) / (group.length - 1)) * Math.PI) / 180;
        const spread = group.length > 1 ? FAN_R : 0;
        out.push({ e, nx, ny, dx: Math.cos(angle) * spread, dy: Math.sin(angle) * spread });
      });
    }
    return out;
  }, [events, box]);

  const offMap = events.filter((e) => e.lat === null || e.lng === null);
  const selected = selectedId
    ? events.find((e) => e.id === selectedId) ?? null
    : null;

  const onSelect = (id: string) => {
    const next = selectedId === id ? null : id;
    setSelectedId(next);
    // Only moves the page when the panel is out of view — clicking a pin on a
    // phone must not bury the card the click just selected.
    if (next) panelRef.current?.scrollIntoView({ block: "nearest" });
  };

  // The scale bar picks the largest "round" distance that stays under 28 %
  // of the field, so it reads at a glance at every zoom level.
  const xSpanKm = box.xSpan * KM_PER_DEG;
  const barKm = [5, 2, 1, 0.5, 0.2, 0.1].find((k) => k / xSpanKm <= 0.28) ?? 0.1;
  const barPct = (barKm / xSpanKm) * 100;

  // Campus zones: a schematic block around each centre, nudged back inside
  // the frame when the campus sits near an edge. `edgeRight` records that the
  // right-edge nudge happened, so the label can be anchored rightward instead
  // of running off a narrow phone frame and wrapping into the pins.
  const zones = CAMPUSES.map((c) => {
    const p = box.at(c);
    const cx = p.nx * VB_W;
    const cy = p.ny * VB_H;
    const edgeRight = cx - ZONE_W / 2 > VB_W - ZONE_W - 12;
    return {
      c,
      edgeRight,
      x: Math.min(Math.max(cx - ZONE_W / 2, 12), VB_W - ZONE_W - 12),
      y: Math.min(Math.max(cy - ZONE_H / 2, 12), VB_H - ZONE_H - 12),
    };
  });

  // The link between campuses: a gentle hand-drawn arc, labelled with the
  // true haversine distance between the two centres.
  const a = box.at(CAMPUSES[0]);
  const b = box.at(CAMPUSES[1]);
  const ax = a.nx * VB_W;
  const ay = a.ny * VB_H;
  const bx = b.nx * VB_W;
  const by = b.ny * VB_H;
  const vx = bx - ax;
  const vy = by - ay;
  const len = Math.hypot(vx, vy) || 1;
  const ctrlX = (ax + bx) / 2 - (vy / len) * 26;
  const ctrlY = (ay + by) / 2 + (vx / len) * 26;
  const midX = (ax + 2 * ctrlX + bx) / 4;
  const midY = (ay + 2 * ctrlY + by) / 4;

  const here = pos ? box.at(pos) : null;
  const hereVisible =
    here !== null && here.nx >= 0 && here.nx <= 1 && here.ny >= 0 && here.ny <= 1;

  return (
    <div className="space-y-3 pb-14">
      <div
        data-map
        className="relative aspect-[3/2] w-full overflow-hidden border-2 border-ink bg-paper sm:aspect-[16/9] lg:max-h-[560px]"
        role="group"
        aria-label={t("events.mapLabel")}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="campus-map-grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path d="M50 0H0V50" fill="none" className="stroke-line" strokeWidth={1} />
            </pattern>
          </defs>
          <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#campus-map-grid)" />

          {/* The campuses are joined by the real straight-line distance. */}
          <path
            d={`M ${ax} ${ay} Q ${ctrlX} ${ctrlY} ${bx} ${by}`}
            fill="none"
            className="stroke-ink"
            strokeWidth={2}
            strokeDasharray="10 8"
          />

          {zones.map(({ c, x, y }) => {
            const p = box.at(c);
            return (
              <g key={c.id}>
                <rect
                  x={x}
                  y={y}
                  width={ZONE_W}
                  height={ZONE_H}
                  className="fill-accent-soft stroke-ink"
                  strokeWidth={2}
                />
                {/* The centre itself is marked at its true projection, so the
                    block never pretends to be a surveyed boundary. */}
                <rect
                  x={p.nx * VB_W - 7}
                  y={p.ny * VB_H - 7}
                  width={14}
                  height={14}
                  className="fill-ink"
                />
              </g>
            );
          })}
        </svg>

        {/* ---- Text layer: real HTML so it stays 13 px+ and translates ---- */}
        <div className="pointer-events-none absolute inset-0">
          {zones.map(({ c, x, y, edgeRight }) => (
            <span
              key={c.id}
              // Capped to the top edge of its zone rather than sitting inside
              // it: the pins project to true coordinates and the northernmost
              // venue lands on that edge, so an in-zone label and the pin
              // field would share the same rows. `bottom` (not `top`) keeps
              // the caption glued to the box whatever the label's line height.
              className={`absolute whitespace-nowrap text-sm font-extrabold uppercase tracking-wider ${
                edgeRight ? "-translate-x-full" : ""
              }`}
              style={{
                left: `${(((edgeRight ? x + ZONE_W - 12 : x + 12)) / VB_W) * 100}%`,
                bottom: `${((VB_H - Math.max(y, 54) + 4) / VB_H) * 100}%`,
              }}
            >
              {c.name}
            </span>
          ))}
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border-2 border-ink bg-paper px-2 py-0.5 text-sm font-semibold"
            // The chip holds a bare number + Latin unit: without an LTR
            // isolate the bidi algorithm prints it "km 2.2" on the Arabic page.
            dir="ltr"
            style={{ left: `${(midX / VB_W) * 100}%`, top: `${(midY / VB_H) * 100}%` }}
          >
            {formatKm(distanceKm(CAMPUSES[0], CAMPUSES[1]), locale)}
          </span>

          {/* North arrow + scale bar, the two things that make a drawing a map. */}
          <span className="absolute right-3 top-3 flex flex-col items-center leading-none">
            <svg width="16" height="24" viewBox="0 0 16 24" aria-hidden="true">
              <path
                d="M8 24V4M2.5 9.5 8 3l5.5 6.5"
                fill="none"
                className="stroke-ink"
                strokeWidth={2}
              />
            </svg>
            <span className="mt-0.5 text-sm font-extrabold">N</span>
          </span>
          <span className="absolute bottom-4 left-4" style={{ width: `${barPct}%` }}>
            <span className="block h-2 border-x-2 border-b-2 border-ink" />
            <span className="absolute bottom-0 start-full ms-2 whitespace-nowrap text-sm font-semibold" dir="ltr">
              {formatKm(barKm, locale)}
            </span>
          </span>
        </div>

        {/* "You are here" — only ever rendered with consented coordinates. */}
        {hereVisible && here && (
          <span
            data-maphere
            className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${here.nx * 100}%`, top: `${here.ny * 100}%` }}
          >
            <span className="h-3.5 w-3.5 rounded-full border-2 border-ink bg-accent" />
            <span className="mt-1 whitespace-nowrap bg-ink px-1.5 py-0.5 text-sm font-semibold text-paper">
              {t("events.mapHere")}
            </span>
          </span>
        )}

        {/* Pins: real buttons, projected from each event's own coordinates. */}
        {pins.map(({ e, nx, ny, dx, dy }) => {
          const isSel = e.id === selectedId;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e.id)}
              aria-pressed={isSel}
              aria-label={t("events.mapPin", { title: e.title, venue: e.location })}
              data-pin={e.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 hover:scale-110"
              style={{ left: `${nx * 100}%`, top: `${ny * 100}%` }}
            >
              <span
                className={`block h-4 w-4 border-2 border-ink ${
                  isSel ? "bg-ink ring-2 ring-accent" : "bg-accent"
                }`}
                style={{ transform: `translate(${dx}px, ${dy}px) rotate(45deg)` }}
              />
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div ref={panelRef}>
          {selected ? (
            <EventCard
              event={selected}
              dealIndex={slots.get(selected.id) ?? 0}
              distance={
                pos && selected.lat !== null && selected.lng !== null
                  ? distanceKm(pos, { lat: selected.lat, lng: selected.lng })
                  : undefined
              }
            />
          ) : (
            <div className="flex min-h-[180px] items-center justify-center border-2 border-ink bg-paper p-6 text-center">
              <p className="text-sm font-semibold text-muted">{t("events.mapHint")}</p>
            </div>
          )}
        </div>

        {/* Events with no coordinates stay listed — never silently dropped. */}
        {offMap.length > 0 && (
          <div className="border-2 border-ink bg-paper p-4 sm:col-span-1 lg:col-span-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider">
              {t("events.mapNoVenue")}
            </h3>
            <ul className="mt-2 divide-y divide-line">
              {offMap.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    className="-mx-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-1 py-2.5 hover:bg-accent-soft"
                  >
                    <span className="font-semibold">{e.title}</span>
                    <span className="text-sm text-muted">
                      {e.location} · {e.dateLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
