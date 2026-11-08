"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/i18n/provider";
import { CAMPUSES, distanceKm, formatKm, nearestCampus, type GeoPos } from "@/lib/geo";
import { EventCard, type EventCardData } from "./EventCard";

/**
 * The campus map view (Phase 10, nationwide in Phase 13). Hand-drawn SVG,
 * no tiles and no API keys: every pin is projected from the event's own
 * lat/lng onto one padded bounding box that frames the whole kingdom.
 *
 * The drawing lives in a fixed internal grid (VB_W × VB_H) while the SVG
 * stretches to whatever shape the container takes (preserveAspectRatio
 * "none"). Pins are real HTML buttons positioned at the very same
 * normalised coordinates, so a stretched frame can distort the shapes but
 * can never make a pin drift off its venue, and buttons keep the focus
 * ring, the 16 px target and the translated aria-label that an SVG <a>
 * would have to reinvent.
 *
 * Two regimes fall out of the fitted span:
 *   local (under NATIONAL_KM): venues sit at their true coordinates, each
 *     anchor campus wears a schematic zone block, and exactly two
 *     campuses are joined by the dashed arc with its true distance;
 *   national: zones and arc step aside for campus dots with collision-free
 *     labels, and events whose projections pile up (whole cities collapse
 *     to a few pixels at country zoom) share a ring around their
 *     centroid, so every pin keeps its own clickable target. The ring is
 *     a bundle affordance, not a position claim: the campus dot under it
 *     is what carries the true coordinates.
 *
 * The rail's campus pick reorders the wall but never narrows this frame:
 * the map always shows the whole filtered wall, exactly like the grid
 * does.
 */

/** Internal drawing grid. The container's aspect may differ (see above). */
const VB_W = 1000;
const VB_H = 700;

/** ~660 m of latitude, so a lone venue still gets a readable frame. */
const MIN_LAT_SPAN = 0.006;
/** Margin around the fitted data: 1.1 = 5 % per side, both axes at once. */
const PAD = 1.1;
/** Above this fitted width the map switches to its country regime. */
const NATIONAL_KM = 60;
/** Metres per degree of latitude: good to ~0.1 % at any map scale. */
const KM_PER_DEG = 111.32;

/** Pin rings are sized in CSS px so the spacing survives every viewport:
 *  floor and ceiling for the ring itself, then two clustering thresholds:
 *  at local zoom venues closer than CLUSTER_PX share a ring (the same
 *  room, two doors apart), while country zoom merges whole city regions
 *  in GRID units so the Casablanca and Rabat bundles behave the same on a
 *  phone and on a desktop (their projected separation is fixed in grid
 *  units, not in screen pixels). */
const RING_MIN_PX = 18;
const RING_MAX_PX = 64;
const CLUSTER_PX = 26;
// Country zoom: one grid unit is ~0.94 km, so intra-city venue spreads
// stay under ~7 units while the closest pair of cities (Casablanca to
// Rabat) sits at 94. Merging below that keeps every ring inside the city
// it belongs to instead of one bundle straddling the two.
const CLUSTER_NATIONAL = 40;
const RING_GAP_PX = 20; // target chord between neighbouring ring pins

/** Campus labels are real HTML text: measured in px, converted through the
 *  frame's own px-per-grid-unit ratio, so the collision grid agrees with
 *  what the browser actually paints at any container size. */
const LABEL_CHAR_PX = 9.8; // uppercase 14 px extrabold + tracking
const LABEL_LINE_PX = 20; // text-sm line box
const LABEL_PAD_PX = 6;

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
 * first: at Casablanca's latitude a degree of longitude is ~83 % of a
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

  // Margin, both axes by the same factor: the aspect survives the padding.
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

type Campus = (typeof CAMPUSES)[number];

/** Axis overlap test for the label collision grid. */
function hits(a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function EventsMap({
  events,
  slots,
  pos,
}: {
  events: EventCardData[];
  /** The dealt poster slots, so the selected card keeps the tone it has on
   *  the wall (see EventsExplorer: filters never re-deal the hand). */
  slots: Map<string, number>;
  /** The viewer's position, only ever set after they asked for "Near me". */
  pos: GeoPos | null;
}) {
  const t = useT();
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The container's real pixel size. Labels and rings are measured in CSS
  // px, then converted through this ratio: the fixed grid stretches with
  // `preserveAspectRatio="none"`, so one px is not one grid unit. The
  // default matches a typical desktop frame; the observer corrects it
  // after mount (same value on server and first client render, so
  // hydration stays clean).
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 880, h: 560 });
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setFrame((f) =>
        Math.abs(f.w - r.width) > 1 || Math.abs(f.h - r.height) > 1
          ? { w: r.width, h: r.height }
          : f
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vbPerPxX = VB_W / Math.max(frame.w, 1);
  const vbPerPxY = VB_H / Math.max(frame.h, 1);

  // The events this frame is about: every filtered event that carries
  // coordinates (the rail's campus pick reorders the wall but never
  // narrows the map).
  const visible = useMemo(
    () => events.filter((e) => e.lat !== null && e.lng !== null),
    [events]
  );

  // Anchors: the visible venues plus the campus each belongs to (the
  // campus dots always have somewhere honest to sit). With nothing on the
  // wall the whole network shows, so an empty frame still reads as a map
  // of the kingdom rather than a blank rectangle.
  const box = useMemo(() => {
    const anchors: GeoPos[] = [];
    if (visible.length) {
      for (const e of visible) {
        const p = { lat: e.lat as number, lng: e.lng as number };
        anchors.push(p, nearestCampus(p));
      }
    } else {
      for (const c of CAMPUSES) anchors.push({ lat: c.lat, lng: c.lng });
    }
    return fitBox(anchors);
  }, [visible]);

  const xSpanKm = box.xSpan * KM_PER_DEG;
  const national = xSpanKm > NATIONAL_KM;

  // Which campuses earn a marker: every campus with a visible event
  // (busiest first, so the labels that matter claim their space before
  // the rest), or the whole network when the wall is empty.
  const anchorCampuses = useMemo<Campus[]>(() => {
    if (!visible.length) return [...CAMPUSES];
    const counts = new Map<string, number>();
    for (const e of visible) {
      const c = nearestCampus({ lat: e.lat as number, lng: e.lng as number });
      counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    }
    return CAMPUSES.filter((c) => counts.has(c.id)).sort(
      (a, b) =>
        (counts.get(b.id) as number) - (counts.get(a.id) as number) ||
        CAMPUSES.indexOf(a) - CAMPUSES.indexOf(b)
    );
  }, [visible]);

  // Campus zones: local frames with a handful of campuses get the
  // schematic block, sized from the span so it never swallows a tight
  // frame or disappears in a wide one. Blocks that would overlap are
  // dropped (that campus keeps its dot and label); the 30 m-apart twins
  // Centre 1 / Centre 2 are the reason this guard exists.
  const zones = useMemo(() => {
    if (national || anchorCampuses.length === 0 || anchorCampuses.length > 3) return [];
    const zoneKm = Math.min(Math.max(xSpanKm * 0.22, 0.25), 3);
    const w = Math.min(Math.max((zoneKm / xSpanKm) * VB_W, 90), 300);
    const h = w * 0.73;
    const out: Array<{ c: Campus; x: number; y: number; w: number; h: number }> = [];
    for (const c of anchorCampuses) {
      const p = box.at(c);
      const x = Math.min(Math.max(p.nx * VB_W - w / 2, 12), VB_W - w - 12);
      const y = Math.min(Math.max(p.ny * VB_H - h / 2, 12), VB_H - h - 12);
      const clash = out.some(
        (z) =>
          x < z.x + z.w + 10 && x + w + 10 > z.x && y < z.y + z.h + 10 && y + h + 10 > z.y
      );
      if (!clash) out.push({ c, x, y, w, h });
    }
    return out;
  }, [national, anchorCampuses, xSpanKm, box]);

  // One pin per event that has coordinates. Venues that project on top of
  // each other (the same room, or a whole city collapsed to a few pixels
  // at country zoom) share a ring around their centroid instead of
  // stacking: the radius is the smallest circle that keeps RING_GAP_PX
  // between neighbouring pins, in px, so the spacing survives every
  // viewport. Single events keep their exact venue.
  const pins = useMemo(() => {
    const pts = visible.map((e) => ({
      e,
      x: box.at({ lat: e.lat as number, lng: e.lng as number }).nx * VB_W,
      y: box.at({ lat: e.lat as number, lng: e.lng as number }).ny * VB_H,
    }));
    if (!pts.length) return [];
    const merge = national ? CLUSTER_NATIONAL : CLUSTER_PX * vbPerPxX;

    type Member = { e: EventCardData; x: number; y: number };
    type Cluster = { members: Member[]; x: number; y: number };
    const clusters: Cluster[] = [];
    for (const pt of pts) {
      let best: Cluster | null = null;
      let bestD = Infinity;
      for (const cl of clusters) {
        const d = Math.hypot(pt.x - cl.x, pt.y - cl.y);
        if (d <= merge && d < bestD) {
          best = cl;
          bestD = d;
        }
      }
      if (best) {
        const n = best.members.length;
        best.x = (best.x * n + pt.x) / (n + 1);
        best.y = (best.y * n + pt.y) / (n + 1);
        best.members.push(pt);
      } else {
        clusters.push({ members: [pt], x: pt.x, y: pt.y });
      }
    }

    const out: Array<{ e: EventCardData; nx: number; ny: number }> = [];
    clusters.forEach((cl, ci) => {
      if (cl.members.length === 1) {
        out.push({ e: cl.members[0].e, nx: cl.members[0].x / VB_W, ny: cl.members[0].y / VB_H });
        return;
      }
      const n = cl.members.length;
      const r =
        Math.min(Math.max(RING_GAP_PX / 2 / Math.sin(Math.PI / n), RING_MIN_PX), RING_MAX_PX) *
        vbPerPxX;
      const phase = ci * 2.399963229728653; // golden angle: rings never align
      cl.members.forEach((m, i) => {
        const ang = phase - Math.PI / 2 + (i * 2 * Math.PI) / n;
        const nx = Math.min(Math.max(cl.x + Math.cos(ang) * r, 14), VB_W - 14) / VB_W;
        const ny = Math.min(Math.max(cl.y + Math.sin(ang) * r, 16), VB_H - 16) / VB_H;
        out.push({ e: m.e, nx, ny });
      });
    });
    return out;
  }, [visible, box, national, vbPerPxX]);

  // Campus labels, placed greedily: each campus tries its slots in turn
  // and keeps the first that fits inside the frame without touching an
  // obstacle (a zone, a pin, the north arrow, the scale bar) or a label
  // already down. A campus that fits nowhere keeps its dot: a dropped
  // caption beats two stacked on top of each other.
  const labels = useMemo(() => {
    const labelH = (LABEL_LINE_PX + 4) * vbPerPxY;
    const labelW = (name: string) => (name.length * LABEL_CHAR_PX + LABEL_PAD_PX) * vbPerPxX;
    type Rect = { x: number; y: number; w: number; h: number };
    const obstacles: Rect[] = [
      // North arrow, top right (svg 16×24 + the N, in its 12 px inset).
      { x: VB_W - (12 + 34) * vbPerPxX, y: 8 * vbPerPxY, w: 38 * vbPerPxX, h: 62 * vbPerPxY },
      // Scale bar, bottom left: 28 % of the field plus its unit label.
      {
        x: 8 * vbPerPxX,
        y: VB_H - (16 + 34) * vbPerPxY,
        w: VB_W * 0.3 + 74 * vbPerPxX,
        h: 46 * vbPerPxY,
      },
      ...zones.map((z) => ({ x: z.x, y: z.y, w: z.w, h: z.h })),
      // Pins keep their buttons above the text layer, but a caption
      // painted over a diamond still hides it: labels dodge both.
      ...pins.map((p) => ({
        x: p.nx * VB_W - 10,
        y: p.ny * VB_H - 10,
        w: 20,
        h: 20,
      })),
    ];
    const out: Array<{ c: Campus; x: number; y: number }> = [];
    const taken: Rect[] = [];
    for (const c of anchorCampuses) {
      const w = labelW(c.name);
      const p = box.at(c);
      const cx = p.nx * VB_W;
      const cy = p.ny * VB_H;
      const zone = zones.find((z) => z.c.id === c.id);
      const slots: Rect[] = [];
      if (zone) {
        // The caption hugs its own block: above the top edge, or below
        // when the top is against the frame.
        slots.push(
          { x: zone.x + 8, y: zone.y - labelH - 5, w, h: labelH },
          { x: zone.x + zone.w - 8 - w, y: zone.y - labelH - 5, w, h: labelH },
          { x: zone.x + 8, y: zone.y + zone.h + 5, w, h: labelH },
          { x: zone.x + zone.w - 8 - w, y: zone.y + zone.h + 5, w, h: labelH }
        );
      } else {
        // Around the dot: two sides × six rows of growing offset.
        const rows = [
          -labelH - 8,
          10,
          -2 * labelH - 18,
          2 * labelH + 20,
          -3 * labelH - 28,
          3 * labelH + 30,
        ];
        for (const dy of rows) {
          slots.push({ x: cx + 12, y: cy + dy, w, h: labelH });
          slots.push({ x: cx - 12 - w, y: cy + dy, w, h: labelH });
        }
      }
      const fit = slots.find(
        (b) =>
          b.x >= 6 &&
          b.x + b.w <= VB_W - 6 &&
          b.y >= 4 &&
          b.y + b.h <= VB_H - 4 &&
          !obstacles.some((o) => hits(b, o)) &&
          !taken.some((o) => hits(b, o))
      );
      if (fit) {
        taken.push(fit);
        out.push({ c, x: fit.x, y: fit.y });
      }
    }
    return out;
  }, [anchorCampuses, zones, pins, box, vbPerPxX, vbPerPxY]);

  // The link between campuses: a gentle hand-drawn arc, labelled with the
  // true haversine distance. Only a local frame with exactly two
  // campuses earns one (a kingdom-wide line between Tanger and Agadir
  // would be noise, and two doors apart is not a journey).
  const arc = useMemo(() => {
    if (national || anchorCampuses.length !== 2) return null;
    const [c0, c1] = anchorCampuses;
    const km = distanceKm(c0, c1);
    if (km < 0.2) return null;
    const a = box.at(c0);
    const b = box.at(c1);
    const ax = a.nx * VB_W;
    const ay = a.ny * VB_H;
    const bx = b.nx * VB_W;
    const by = b.ny * VB_H;
    const vx = bx - ax;
    const vy = by - ay;
    const len = Math.hypot(vx, vy) || 1;
    const ctrlX = (ax + bx) / 2 - (vy / len) * 26;
    const ctrlY = (ay + by) / 2 + (vx / len) * 26;
    return {
      d: `M ${ax} ${ay} Q ${ctrlX} ${ctrlY} ${bx} ${by}`,
      midX: (ax + 2 * ctrlX + bx) / 4,
      midY: (ay + 2 * ctrlY + by) / 4,
      km,
    };
  }, [national, anchorCampuses, box]);

  const offMap = events.filter((e) => e.lat === null || e.lng === null);
  const selected = selectedId
    ? events.find((e) => e.id === selectedId) ?? null
    : null;

  const onSelect = (id: string) => {
    const next = selectedId === id ? null : id;
    setSelectedId(next);
    // Only moves the page when the panel is out of view: clicking a pin on
    // a phone must not bury the card the click just selected.
    if (next) panelRef.current?.scrollIntoView({ block: "nearest" });
  };

  // The scale bar picks the largest "round" distance that stays under 28 %
  // of the field, so it reads at a glance at every zoom level, from a
  // street corner to the Straits of Gibraltar.
  const barKm =
    [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1].find((k) => k / xSpanKm <= 0.28) ?? 0.1;
  const barPct = (barKm / xSpanKm) * 100;

  const here = pos ? box.at(pos) : null;
  const hereVisible =
    here !== null && here.nx >= 0 && here.nx <= 1 && here.ny >= 0 && here.ny <= 1;

  return (
    <div className="space-y-3 pb-14">
      <div
        ref={frameRef}
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

          {arc && (
            <path
              d={arc.d}
              fill="none"
              className="stroke-ink"
              strokeWidth={2}
              strokeDasharray="10 8"
            />
          )}

          {zones.map(({ c, x, y, w, h }) => (
            <rect
              key={c.id}
              x={x}
              y={y}
              width={w}
              height={h}
              className="fill-accent-soft stroke-ink"
              strokeWidth={2}
            />
          ))}

          {/* Every anchor campus is marked at its true projection, so no
              block or ring ever pretends to be a surveyed boundary. */}
          {anchorCampuses.map((c) => {
            const p = box.at(c);
            return (
              <rect
                key={c.id}
                x={p.nx * VB_W - 7}
                y={p.ny * VB_H - 7}
                width={14}
                height={14}
                className="fill-ink"
              />
            );
          })}
        </svg>

        {/* ---- Text layer: real HTML so it stays 13 px+ and translates ---- */}
        <div className="pointer-events-none absolute inset-0">
          {labels.map(({ c, x, y }) => (
            <span
              key={c.id}
              className="absolute whitespace-nowrap text-sm font-extrabold uppercase tracking-wider"
              style={{ left: `${(x / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%` }}
            >
              {c.name}
            </span>
          ))}
          {arc && (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border-2 border-ink bg-paper px-2 py-0.5 text-sm font-semibold"
              // The chip holds a bare number + Latin unit: without an LTR
              // isolate the bidi algorithm prints it "km 2.2" on the Arabic page.
              dir="ltr"
              style={{
                left: `${(arc.midX / VB_W) * 100}%`,
                top: `${(arc.midY / VB_H) * 100}%`,
              }}
            >
              {formatKm(arc.km, locale)}
            </span>
          )}

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
        {pins.map(({ e, nx, ny }) => {
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
                style={{ transform: "rotate(45deg)" }}
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
              // Map view has no intermediate sections: straight from the
              // page h1 to the card title (a11y heading-order).
              headingLevel={2}
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

        {/* Events with no coordinates stay listed: never silently dropped. */}
        {offMap.length > 0 && (
          <div className="border-2 border-ink bg-paper p-4 sm:col-span-1 lg:col-span-2">
            {/* h2, not h3: the map panel is the only section below the
                page h1 (the card above may not be selected). */}
            <h2 className="text-sm font-extrabold">
              {t("events.mapNoVenue")}
            </h2>
            {/* Space, not rules: the detector bans hairline dividers (the
                rows already carry py + a hover tone). */}
            <ul className="mt-2 space-y-1">
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
