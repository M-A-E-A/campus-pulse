"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { searchMatches } from "@/lib/search";
import { Entrance } from "@/components/Entrance";
import { ClubCard } from "./ClubCard";
import type { ClubDirectoryEntry } from "@/lib/queries";

/**
 * The clubs directory: one ink band, one orange search rail (the events
 * page's own idiom, one control instead of five), then the paper field of
 * poster cards.
 *
 * Search is the shipped normalizeSearch/searchMatches module — the same
 * Arabic-aware matcher the events explorer uses, over name + description.
 * Debounced 250ms so the wall settles between keystrokes instead of
 * re-rendering per letter. Probe hooks: data-clubsearch (input),
 * data-clubcount (count line), data-clubcard / data-clublink (cards),
 * data-clubsempty (no-match state).
 */
export function ClubsExplorer({
  clubs,
  followingIds,
  isAuthenticated,
}: {
  clubs: ClubDirectoryEntry[];
  followingIds: string[];
  isAuthenticated: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebounced(query), 250);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query]);

  const filtered = useMemo(() => {
    const q = debounced.trim();
    if (!q) return clubs;
    return clubs.filter((c) => searchMatches(`${c.name} ${c.description}`, q));
  }, [clubs, debounced]);

  const clear = () => {
    setQuery("");
    setDebounced("");
  };

  const hasQuery = debounced.trim() !== "";

  return (
    <div className="field-paper min-h-screen">
      <Entrance />

      {/* Header: the same ink band the events wall wears, words carrying it. */}
      <header className="field-ink" data-rise>
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:pt-16">
          <h1 className="display-hero">{t("clubs.title")}</h1>
          <p className="mt-3 max-w-[46ch] text-[length:var(--step-lead)]">
            {t("clubs.sub")}
          </p>
        </div>
      </header>

      {/* Search rail: orange band butted against the ink header — one input
          and the live count, nothing else. */}
      <div className="field-orange" data-rise>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <input
            className="input max-w-xs flex-1 rounded-none border-2 border-ink bg-ink text-paper placeholder:text-paper/60 sm:flex-none"
            type="search"
            placeholder={t("clubs.searchPlaceholder")}
            aria-label={t("clubs.searchLabel")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-clubsearch
          />
          <p
            className="text-sm font-semibold"
            data-clubcount
          >
            {t("clubs.count", { shown: filtered.length, total: clubs.length })}
          </p>
          {hasQuery && (
            <button
              className="btn btn-secondary border-2 border-ink"
              onClick={clear}
              data-clubclear
            >
              {t("clubs.clear")}
            </button>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-14 pt-6">
        {filtered.length === 0 ? (
          <div className="empty" data-clubsempty>
            <p>{t("clubs.empty")}</p>
            {hasQuery && (
              <button className="btn btn-secondary mt-4" onClick={clear} data-clubclear>
                {t("clubs.clear")}
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-clubgrid
          >
            {filtered.map((c) => (
              <ClubCard
                key={c.id}
                club={c}
                isFollowing={followingIds.includes(c.id)}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
