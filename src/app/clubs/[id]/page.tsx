import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getClubDirectory,
  getClubUpcomingEvents,
  getFollowedClubIds,
} from "@/lib/queries";
import { getLocale, getT } from "@/i18n/server";
import { Entrance } from "@/components/Entrance";
import { FollowButton } from "@/components/FollowButton";
import { EventCard } from "@/components/events/EventCard";

// Follow state is per-request (session read) — dynamic, with the counts
// coming from the same tagged cache the directory uses, so the two views
// can never disagree about a follower number.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const locale = await getLocale();
  const [clubs, t] = await Promise.all([getClubDirectory(locale), getT()]);
  const club = clubs.find((c) => c.id === id);
  if (!club) return { title: t("clubs.metaNotFound") };
  const description =
    club.description.length > 155
      ? `${club.description.slice(0, 152)}…`
      : club.description;
  return {
    title: `${club.name} — Campus Pulse`,
    description,
    // No openGraph.images: the opengraph-image.tsx file convention owns
    // og:image (1200×630, width/height/type injected by Next).
    openGraph: { title: club.name, description },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ClubProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const [clubs, session] = await Promise.all([
    getClubDirectory(locale),
    auth(),
  ]);
  // The directory lists every club — unknown id lands on the real 404,
  // never on an empty profile wearing a URL.
  const club = clubs.find((c) => c.id === id);
  if (!club) notFound();

  const t = await getT();
  const [events, followingIds] = await Promise.all([
    getClubUpcomingEvents(club.id, locale),
    session?.user ? getFollowedClubIds(session.user.id) : Promise.resolve([]),
  ]);
  const isAuthenticated = Boolean(session?.user);
  const isFollowing = followingIds.includes(club.id);

  return (
    <div className="field-paper min-h-screen" data-clubprofile>
      <Entrance />

      {/* Poster profile: ink band carrying the monogram stamp + name. */}
      <header className="field-ink">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-14">
          <Link
            href="/clubs"
            data-rise
            className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 rtl:-scale-x-100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
            {t("clubs.backToAll")}
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-5" data-rise>
            <span
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center bg-accent text-4xl font-extrabold text-ink"
            >
              {club.name.charAt(0).toUpperCase()}
            </span>
            <h1 className="display-title min-w-0 break-words">{club.name}</h1>
          </div>
        </div>
      </header>

      {/* Action rail: the event detail's orange strip — follow + the honest
          hint of what following does, on the ground the buttons were drawn
          for. */}
      <div className="field-orange" data-rise>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <FollowButton
            clubId={club.id}
            initialFollowing={isFollowing}
            isAuthenticated={isAuthenticated}
          />
          <p className="text-sm font-semibold">{t("clubs.followHint")}</p>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-14 pt-8">
        {/* Counts as poster stat boxes — same ink-ruled idiom as the event
            page's data boxes: followers, what's ahead, what's behind. */}
        <div className="grid max-w-xl grid-cols-3 gap-3" data-clubstats data-rise>
          <div className="border-2 border-ink bg-surface p-4">
            <p className="text-2xl font-bold tabular-nums">{club.followers}</p>
            <p className="mt-0.5 text-sm text-muted">{t("clubs.statFollowers")}</p>
          </div>
          <div className="border-2 border-ink bg-surface p-4">
            <p className="text-2xl font-bold tabular-nums">{club.upcoming}</p>
            <p className="mt-0.5 text-sm text-muted">{t("clubs.statUpcoming")}</p>
          </div>
          <div className="border-2 border-ink bg-surface p-4">
            <p className="text-2xl font-bold tabular-nums">{club.past}</p>
            <p className="mt-0.5 text-sm text-muted">{t("clubs.statPast")}</p>
          </div>
        </div>

        <h2 className="display-chapter mt-12" data-rise>
          {t("detail.about")}
        </h2>
        <p
          className="mt-4 max-w-[38rem] whitespace-pre-line text-[length:var(--step-body)] leading-relaxed"
          data-rise
        >
          {club.description}
        </p>

        <h2 className="display-chapter mt-14" data-rise>
          {t("clubs.eventsTitle")}
        </h2>
        {events.length === 0 ? (
          <div className="empty mt-5" data-clubeventsempty>
            {t("clubs.noUpcoming")}
          </div>
        ) : (
          <div
            className="mt-5 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-clubevents
            data-rise
          >
            {events.map((e, i) => (
              <div key={e.id} data-rise>
                <EventCard event={e} dealIndex={i} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
