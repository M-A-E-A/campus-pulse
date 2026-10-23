"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useT } from "@/i18n/provider";
import { EventCard, type EventCardData } from "./EventCard";

gsap.registerPlugin(Flip);

type Category = { id: string; name: string };

type Filters = {
  query: string;
  categoryId: string; // "" = all
  when: "any" | "today" | "week" | "month";
  view: "grid" | "calendar";
};

const EMPTY_FILTERS: Filters = { query: "", categoryId: "", when: "any", view: "grid" };

function matchesFilters(e: EventCardData, f: Filters): boolean {
  const q = f.query.trim().toLowerCase();
  if (q && !`${e.title} ${e.location} ${e.club.name}`.toLowerCase().includes(q)) return false;
  if (f.categoryId && e.category.id !== f.categoryId) return false;

  if (f.when !== "any") {
    const start = new Date(e.startsAt);
    const now = new Date();
    if (f.when === "today") {
      if (start.toDateString() !== now.toDateString()) return false;
    } else {
      const days = f.when === "week" ? 7 : 31;
      const limit = new Date(now);
      limit.setDate(limit.getDate() + days);
      if (start < now || start > limit) return false;
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

  // GSAP Flip, done the way the docs prescribe for React:
  // 1. capture card positions BEFORE the state change (in setFilter below),
  // 2. let React commit the new list,
  // 3. Flip.from in a layout effect, using the captured state.
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);

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
  }, [filtered]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    // Capture positions of visible cards while they still sit where the
    // user sees them. Skip when switching view — layouts differ entirely.
    if (key !== "view" && gridRef.current) {
      flipState.current = Flip.getState(
        gridRef.current.querySelectorAll("[data-flip-id]")
      );
    }
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const hasActiveFilters =
    debouncedQuery.trim() !== "" ||
    filters.categoryId !== "" ||
    filters.when !== "any";

  const calendar = groupByDay(filtered);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-bold">{t("events.title")}</h1>
      <p className="mt-2 text-muted">{t("events.sub")}</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          type="search"
          placeholder={t("events.searchPlaceholder")}
          aria-label={t("events.searchLabel")}
          value={filters.query}
          onChange={(e) => setFilter("query", e.target.value)}
        />
        <select
          className="input max-w-[14rem]"
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
          className="input max-w-[12rem]"
          aria-label={t("events.dateLabel")}
          value={filters.when}
          onChange={(e) => setFilter("when", e.target.value as Filters["when"])}
        >
          <option value="any">{t("events.dateAny")}</option>
          <option value="today">{t("events.dateToday")}</option>
          <option value="week">{t("events.dateWeek")}</option>
          <option value="month">{t("events.dateMonth")}</option>
        </select>
        <div className="ms-auto flex overflow-hidden rounded-lg border border-line" role="group" aria-label={t("events.viewLabel")}>
          {(["grid", "calendar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter("view", v)}
              aria-pressed={filters.view === v}
              className={`px-3.5 py-2 text-sm font-medium ${
                filters.view === v ? "bg-ink text-paper" : "bg-surface hover:bg-line/50"
              }`}
            >
              {v === "grid" ? t("events.viewGrid") : t("events.viewCalendar")}
            </button>
          ))}
        </div>
      </div>

      {/* Result count + quick reset */}
      <div className="mt-4 flex items-center gap-3 text-sm text-muted" role="status">
        <span>
          {t("events.count", { shown: filtered.length, total: initialEvents.length })}
          {hasActiveFilters ? ` ${t("events.countFiltered")}` : ""}
        </span>
        {hasActiveFilters && (
          <button
            className="font-semibold text-accent-dark hover:underline"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            {t("events.clearFilters")}
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="empty mt-10">
          <p className="font-semibold">{t("events.empty")}</p>
          <button
            className="btn btn-secondary mt-4"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            {t("events.clearFilters")}
          </button>
        </div>
      ) : filters.view === "grid" ? (
        <div ref={gridRef} className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div ref={gridRef} className="mt-8 space-y-8">
          {calendar.map(([day, evts]) => (
            <section key={day}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{day}</h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {evts.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
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
