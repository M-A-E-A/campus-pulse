// Uses useT — imported by the client ClubsExplorer, but declared outright
// so no future server import can walk it back into the server bundle.
"use client";

import Link from "next/link";
import { useT } from "@/i18n/provider";
import { FollowButton } from "@/components/FollowButton";
import type { ClubDirectoryEntry } from "@/lib/queries";

/**
 * One club in the directory: a flat poster card — ink monogram, name,
 * description, the counts — and the follow toggle as a SIBLING of the link,
 * never nested inside it (a button within an <a> is invalid HTML and breaks
 * middle-click / keyboard semantics).
 *
 * The whole header block links through to the profile, so the card still
 * reads as one click target; the footer strip is the action strip.
 */
export function ClubCard({
  club,
  isFollowing,
  isAuthenticated,
}: {
  club: ClubDirectoryEntry;
  isFollowing: boolean;
  isAuthenticated: boolean;
}) {
  const t = useT();
  const id = club.id;

  return (
    <article
      data-clubcard
      data-club={id}
      data-rise
      className="card-lift flex flex-col border-2 border-ink bg-paper"
    >
      <Link
        href={`/clubs/${id}`}
        className="flex flex-1 flex-col gap-3 p-5 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
        data-clublink
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center bg-ink text-xl font-extrabold text-paper"
          >
            {club.name.charAt(0).toUpperCase()}
          </span>
          <h2 className="min-w-0 text-lg font-bold leading-snug break-words">
            {club.name}
          </h2>
        </div>
        <p className="line-clamp-3 text-base leading-relaxed text-ink/75">
          {club.description}
        </p>
        {/* Counts as one meta line: how much is on the calendar, when the
            next date lands, how many follow. Labels are i18n vars — the
            numbers are data, not copy. 14px: the 12px subline size fails
            the detector's small-text bar on a public page. */}
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-sm font-semibold text-muted">
          <span>{t("clubs.statsUpcoming", { n: club.upcoming })}</span>
          <span aria-hidden="true">·</span>
          {club.nextLabel ? (
            <span>{t("clubs.next", { date: club.nextLabel })}</span>
          ) : (
            <span>{t("clubs.noEvents")}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{t("clubs.followers", { n: club.followers })}</span>
        </p>
      </Link>
      <div className="border-t-2 border-ink px-5 py-3">
        <FollowButton
          clubId={id}
          initialFollowing={isFollowing}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </article>
  );
}
