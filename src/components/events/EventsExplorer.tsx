"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useT } from "@/i18n/provider";
import { campusDayKey, campusDayLimit, campusTodayKey } from "@/lib/tz";
import { searchMatches } from "@/lib/search";
import { CAMPUSES, distanceKm, nearestCampus, type GeoPos } from "@/lib/geo";
import { EventCard, type EventCardData } from "./EventCard";
import { EventsMap } from "./EventsMap";

gsap.registerPlugin(Flip, useGSAP);

type Category = { id: string; name: string };

type Filters = {
  query: string;
  categoryId: string; // "" = all
  when: "any" | "today" | "week" | "month";
  view: "grid" | "calendar" | "map";
};

const EMPTY_FILTERS: Filters = { query: "", categoryId: "", when: "any", view: "grid" };

function matchesFilters(e: EventCardData, f: Filters): boolean {
  // All four searchable fields — title, location, club AND category (the
  // old matcher silently missed category). Normalization runs on both the
  // haystack and the query, so Arabic diacritics / alef variants / ta
  // marbuta and pasted direction marks still hit the stored text.
  if (
    !searchMatches(
      `${e.title} ${e.location} ${e.club.name} ${e.category.name}`,
      f.query
    )
  )
    return false;
  if (f.categoryId && e.category.id !== f.categoryId) return false;

  if (f.when !== "any") {
    // Campus zone (Africa/Casablanca): the filter must agree with the labels
    // the card prints — never the device's own zone (see src/lib/tz.ts).
    const now = new Date();
    const start = new Date(e.startsAt);
    const end = new Date(e.endsAt);
    if (f.when === "today") {
      // Today = the printed day is today, or the event is running right now.
      if (
        campusDayKey(start) !== campusTodayKey() &&
        !(start <= now && end >= now)
      )
        return false;
    } else {
      // "Next N days" = the event happens inside the window — a running event
      // started yesterday still happens inside it; one already finished does
      // not. The limit is campus-local midnight, matching the printed label
      // (7 and 30 days, as the copy says).
      const limit = campusDayLimit(f.when === "week" ? 7 : 30);
      if (end < now || start > limit) return false;
    }
  }
  return true;
}

export function EventsExplorer({
  initialEvents,
  categories,
}: {
  initialEvents: EventCardData[];
  categories: Category[];
}) {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // GSAP Flip capture slot (the docs' React recipe: capture BEFORE the state
  // change — in setFilter and the location handlers — then replay in the
  // layout effect below). Declared up here so every capturer can see it.
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);

  // Debounce typing so Flip doesn't fire on every keystroke.
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedQuery(filters.query), 250);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [filters.query]);

  const activeFilters: Filters = useMemo(
    () => ({ ...filters, query: debouncedQuery }),
    [filters, debouncedQuery]
  );

  const filtered = useMemo(
    () => initialEvents.filter((e) => matchesFilters(e, activeFilters)),
    [initialEvents, activeFilters]
  );

  // ---- Location (Phase 8) --------------------------------------------------
  // "Near me" asks for geolocation ON CLICK — never on load, so no surprise
  // permission prompts. Granted → strict distance order + a km label on every
  // card that has coordinates. The first grant also auto-picks the nearest
  // campus and persists it (localStorage); the campus select overrides or
  // clears that choice. Venue-unknown events keep date order at the end —
  // they claim no distance.
  const [pos, setPos] = useState<GeoPos | null>(null);
  const [locState, setLocState] = useState<"off" | "on" | "denied">("off");
  const [campusId, setCampusId] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cp-campus");
      if (saved && CAMPUSES.some((c) => c.id === saved)) setCampusId(saved);
    } catch {
      // Private mode: the default (all campuses) simply stays.
    }
  }, []);

  const captureFlip = () => {
    if (gridRef.current) {
      flipState.current = Flip.getState(
        gridRef.current.querySelectorAll("[data-flip-id]")
      );
    }
  };

  const onNearMe = () => {
    if (locState === "on") {
      // Toggle off: the campus preference stays, the distance sort goes.
      setLocState("off");
      setPos(null);
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocState("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(here);
        setLocState("on");
        // First grant picks the nearest campus — unless one is already chosen.
        setCampusId((cur) => {
          if (cur) return cur;
          const picked = nearestCampus(here).id;
          try {
            localStorage.setItem("cp-campus", picked);
          } catch {
            // Private mode: the pick still applies for this visit.
          }
          return picked;
        });
      },
      () => setLocState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const onCampus = (id: string) => {
    setCampusId(id);
    try {
      if (id) localStorage.setItem("cp-campus", id);
      else localStorage.removeItem("cp-campus");
    } catch {
      // Private mode: the choice applies for this visit only.
    }
  };

  // Ordering, layered and stable: the campus preference pulls its events to
  // the front (date order survives inside each group); the near-me state then
  // orders strictly by distance. Both sorts keep the server's list index as
  // tie-breaker, so the wall never shuffles arbitrarily — and the posters
  // keep their dealt tones (slots stay keyed to the server order).
  const ordered = useMemo(() => {
    const base = filtered.map((e, i) => ({ e, i }));
    if (campusId) {
      base.sort((a, b) => {
        const matches = (x: (typeof base)[number]) =>
          x.e.lat !== null &&
          x.e.lng !== null &&
          nearestCampus({ lat: x.e.lat, lng: x.e.lng }).id === campusId;
        return Number(matches(b)) - Number(matches(a)) || a.i - b.i;
      });
    }
    if (locState === "on" && pos) {
      base.sort((a, b) => {
        const dist = (x: (typeof base)[number]) =>
          x.e.lat === null || x.e.lng === null
            ? Infinity
            : distanceKm(pos, { lat: x.e.lat, lng: x.e.lng });
        return dist(a) - dist(b) || a.i - b.i;
      });
    }
    return base.map(({ e }) => e);
  }, [filtered, campusId, locState, pos]);

  // The dealt hand: every event keeps its poster slot (colour + height) from
  // its position in the server's list. Filters only remove cards — they
  // never re-deal the wall, so posters stay recognisable across keystrokes.
  const slots = useMemo(
    () => new Map(initialEvents.map((e, i) => [e.id, i] as const)),
    [initialEvents]
  );

  // Flip replay: positions were captured before the state change (setFilter
  // and the location handlers); commit has happened, so play the transition.
  useLayoutEffect(() => {
    if (!flipState.current || !gridRef.current) return;
    const state = flipState.current;
    flipState.current = null;
    Flip.from(state, {
      duration: 0.45,
      ease: "power2.inOut",
      absolute: true,
      stagger: 0.03,
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.35 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.95, duration: 0.25 }),
    });
  }, [ordered]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    // Capture positions of visible posters while they still sit where the
    // user sees them. Skip when switching view — layouts differ entirely.
    if (key !== "view" && gridRef.current) {
      flipState.current = Flip.getState(
        gridRef.current.querySelectorAll("[data-flip-id]")
      );
    }
    setFilters((f) => ({ ...f, [key]: value }));
  };

  // One reset, both call sites. Keeps the calendar view (dropping a calendar
  // user back to grid was a real side-effect) and clears the debounced query
  // in the same tick so results, count and the reset button update together.
  const resetFilters = () => {
    if (gridRef.current) {
      flipState.current = Flip.getState(
        gridRef.current.querySelectorAll("[data-flip-id]")
      );
    }
    setDebouncedQuery("");
    setFilters((f) => ({ ...EMPTY_FILTERS, view: f.view }));
  };

  const hasActiveFilters =
    debouncedQuery.trim() !== "" ||
    filters.categoryId !== "" ||
    filters.when !== "any";

  const calendar = groupByDay(ordered);

  // Load choreography: the wall arrives. Guarded so the reduced page is the
  // finished page — nothing stays hidden waiting for an animation that will
  // not run (inspector: reduced-hidden).
  const root = useRef<HTMLDivElement>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  useGSAP(
    () => {
      if (reduced.current || !root.current) return;
      const bands = root.current.querySelectorAll("[data-band]");
      const posters = gridRef.current?.querySelectorAll("[data-flip-id]") ?? [];
      gsap.from(bands, {
        y: 40,
        opacity: 0,
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.07,
        delay: 0.05,
      });
      gsap.from(posters, {
        y: 28,
        opacity: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
        delay: 0.2,
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="field-paper min-h-screen">
      {/* Header: an ink band, cropped by the fold, the words carrying it. */}
      <header className="field-ink" data-band>
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-16">
          <h1 className="display-hero">{t("events.title")}</h1>
          <p className="mt-3 max-w-[46ch] text-[length:var(--step-lead)]">
            {t("events.sub")}
          </p>
        </div>
      </header>

      {/* Filter rail: a flat orange band butted against the ink header. */}
      <div className="field-orange" data-band>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <input
            className="input max-w-xs rounded-none border-2 border-ink bg-ink text-paper placeholder:text-paper/60"
            type="search"
            placeholder={t("events.searchPlaceholder")}
            aria-label={t("events.searchLabel")}
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
          />
          <select
            className="input max-w-[20rem] flex-1 rounded-none border-2 border-ink bg-paper sm:flex-none"
            aria-label={t("events.categoryLabel")}
            value={filters.categoryId}
            onChange={(e) => setFilter("categoryId", e.target.value)}
          >
            <option value="">{t("events.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="input max-w-[12rem] rounded-none border-2 border-ink bg-paper"
            aria-label={t("events.dateLabel")}
            value={filters.when}
            onChange={(e) => setFilter("when", e.target.value as Filters["when"])}
          >
            <option value="any">{t("events.dateAny")}</option>
            <option value="today">{t("events.dateToday")}</option>
            <option value="week">{t("events.dateWeek")}</option>
            <option value="month">{t("events.dateMonth")}</option>
          </select>
          <button
            type="button"
            onClick={() => {
              captureFlip();
              onNearMe();
            }}
            aria-pressed={locState === "on"}
            className={`flex items-center gap-1.5 border-2 border-ink px-3.5 py-2 text-sm font-semibold transition-colors ${
              locState === "on"
                ? "bg-ink text-paper"
                : "bg-paper text-ink hover:bg-accent-soft"
            }`}
            data-near
          >
            {/* Crosshair: drawn, never an emoji pin. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="7" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            {t("events.nearMe")}
          </button>
          <select
            className="input max-w-[13rem] rounded-none border-2 border-ink bg-paper"
            aria-label={t("events.campusLabel")}
            value={campusId}
            onChange={(e) => {
              captureFlip();
              onCampus(e.target.value);
            }}
            data-campus
          >
            <option value="">{t("events.campusAll")}</option>
            {CAMPUSES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {locState === "denied" && (
            <span className="text-sm font-semibold" role="status">
              {t("events.locDenied")}
            </span>
          )}
          <div
            className="flex overflow-hidden border-2 border-ink sm:ms-auto"
            role="group"
            aria-label={t("events.viewLabel")}
          >
            {(["grid", "calendar", "map"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilter("view", v)}
                aria-pressed={filters.view === v}
                data-view={v}
                className={`px-3.5 py-2 text-sm font-semibold transition-colors ${
                  filters.view === v ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-accent-soft"
                }`}
              >
                {v === "grid"
                  ? t("events.viewGrid")
                  : v === "calendar"
                    ? t("events.viewCalendar")
                    : t("events.viewMap")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Count + reset, on the paper field just under the rail. */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-center gap-3 py-4 text-sm" role="status">
          <span className="font-semibold">
            {t("events.count", { shown: filtered.length, total: initialEvents.length })}
            {hasActiveFilters ? ` ${t("events.countFiltered")}` : ""}
          </span>
          {hasActiveFilters && (
            <button
              className="font-semibold underline underline-offset-4 hover:text-accent-dark"
              onClick={resetFilters}
            >
              {t("events.clearFilters")}
            </button>
          )}
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="empty mb-12">
            <p className="font-semibold">
              {hasActiveFilters ? t("events.empty") : t("events.emptyAll")}
            </p>
            {hasActiveFilters && (
              <button className="btn btn-secondary mt-4" onClick={resetFilters}>
                {t("events.clearFilters")}
              </button>
            )}
          </div>
        ) : filters.view === "grid" ? (
          <div
            ref={gridRef}
            className="grid grid-cols-1 items-start gap-3 pb-14 sm:grid-cols-2 lg:grid-cols-3"
          >
            {ordered.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                dealIndex={slots.get(e.id) ?? 0}
                distance={
                  locState === "on" && pos && e.lat !== null && e.lng !== null
                    ? distanceKm(pos, { lat: e.lat, lng: e.lng })
                    : undefined
                }
              />
            ))}
          </div>
        ) : filters.view === "calendar" ? (
          <div ref={gridRef} className="space-y-10 pb-14">
            {calendar.map(([day, evts]) => (
              <section key={day}>
                <h2 className="display-chapter mb-3">{day}</h2>
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {evts.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      dealIndex={slots.get(e.id) ?? 0}
                      distance={
                        locState === "on" && pos && e.lat !== null && e.lng !== null
                          ? distanceKm(pos, { lat: e.lat, lng: e.lng })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div ref={gridRef}>
            <EventsMap
              events={ordered}
              slots={slots}
              pos={locState === "on" && pos ? pos : null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function groupByDay(events: EventCardData[]): Array<[string, EventCardData[]]> {
  const groups = new Map<string, EventCardData[]>();
  for (const e of events) {
    // dayLabel is computed on the server (tzdata-safe) — see events/page.tsx.
    const key = e.dayLabel;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  return [...groups.entries()];
}
