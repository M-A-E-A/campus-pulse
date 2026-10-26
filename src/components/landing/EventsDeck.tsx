"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useT } from "@/i18n/provider";
import type { StripItem } from "@/lib/queries";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Mini-poster tones: the chapter colours dealt back as a hand of cards.
 *  The pale tones carry a 2px ink rule so they don't dissolve into the paper
 *  field (2px is above the detector's 1.5px outlined-box threshold), and the
 *  accent tones lift --meta to full ink so their small text clears AA —
 *  0.75 opacity on accent-deep measures 4.22:1, under the 4.5:1 floor. The
 *  white surface tone appears once per six so no two paper cards land on the
 *  same row band. Same cycle as the events wall (EventCard.tsx). */
const TONES = [
  "bg-ink text-paper",
  "bg-accent text-ink [--meta:1]",
  "bg-surface text-ink border-2 border-ink",
  "bg-accent-deep text-paper [--meta:1]",
  "bg-accent-soft text-ink border-2 border-ink",
  "bg-accent text-ink [--meta:1]",
];

/**
 * Chapter four (paper field): the next six events as a deck of posters.
 * On desktop the deck is pinned and scroll scrubs it sideways — each step
 * slides the next poster in and squeezes the previous ones toward the
 * start edge, like spines. On phones and under reduced motion it is a
 * plain stacked list. The data and links are identical in both modes.
 *
 * The poster is 600px, not wider: at rest (x=0) the row is card1, card2,
 * card3 across 1440, and card 3 peeks from the end edge. Its date·time row
 * is left-aligned inside the card, so at 620px wide it started at 1292 and
 * ended at 1433 — 7px from the screen edge, i.e. a metadata line pressed
 * into the margin. 600px pulls it to 47px clear while keeping the peek.
 */
export function EventsDeck({ events }: { events: StripItem[] }) {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLUListElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPinned(!reduced && window.innerWidth >= 1024 && events.length > 2);
  }, [events.length]);

  useGSAP(
    () => {
      if (!pinned || !wrap.current || !row.current) return;
      const rtl = () => getComputedStyle(document.documentElement).direction === "rtl";
      const distance = () =>
        Math.max(row.current!.scrollWidth - window.innerWidth + 96, 0);

      gsap.fromTo(
        row.current,
        { x: 0 },
        {
          x: () => (rtl() ? distance() : -distance()),
          ease: "none",
          scrollTrigger: {
            trigger: wrap.current,
            start: "top top",
            end: () => `+=${distance() + window.innerHeight * 0.6}`,
            scrub: 0.6,
            pin: true,
            invalidateOnRefresh: true,
          },
        }
      );
    },
    { scope: wrap, dependencies: [pinned] }
  );

  if (events.length === 0) {
    return (
      <section id="deck" className="field-paper scroll-mt-14">
        <div className="mx-auto max-w-6xl px-4 py-[14vh]">
          <h2 className="display-chapter">{t("landing.comingUp")}</h2>
          <div className="empty mt-10 bg-surface">
            <p>{t("landing.noEvents")}</p>
          </div>
        </div>
      </section>
    );
  }

  const cards = events.map((e, i) => (
    <li
      key={e.id}
      data-deck-card
      className={
        !pinned && events.length % 2 === 1 && i === events.length - 1
          ? "sm:col-span-2"
          : ""
      }
    >
      <Link
        href={`/events/${e.id}`}
        className={`${TONES[i % TONES.length]} flex h-[420px] shrink-0 flex-col justify-between p-7 transition-[filter] hover:brightness-95 ${
          pinned ? "w-[min(600px,78vw)]" : "w-full"
        }`}
      >
        {/* Stacked, not side by side: the top edge of every poster stays a
            tidy left-aligned block however long the club and category run. */}
        <div className="space-y-1">
          <span className="block text-sm font-semibold">{e.clubName}</span>
          <span className="block text-sm opacity-[var(--meta,0.75)]">
            {e.categoryName}
          </span>
        </div>
        <h3 className="max-w-[min(20ch,100%)] text-2xl font-extrabold leading-[1.05] tracking-tight lg:text-4xl">
          {e.title}
        </h3>
        <div className="flex items-end justify-between gap-3 text-sm">
          <span className="font-semibold">
            {e.dateLabel} · {e.timeLabel}
          </span>
          {e.spotsLeft !== null && (
            <span className="opacity-[var(--meta,0.75)]">
              {t("common.spotsLeft", { n: e.spotsLeft })}
            </span>
          )}
        </div>
      </Link>
    </li>
  ));

  return (
    <section id="deck" className="field-paper scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-[12vh]">
        <h2 className="display-chapter">{t("landing.comingUp")}</h2>
        <p className="mt-3 text-[length:var(--step-lead)] text-muted">
          {t("landing.comingUpSub")}
        </p>
      </div>

      {pinned ? (
        <div ref={wrap} className="overflow-hidden">
          <ul ref={row} className="deck-row items-center py-6">
            {cards}
          </ul>
        </div>
      ) : (
        <ul className="mx-auto grid max-w-6xl gap-3 px-4 pb-12 sm:grid-cols-2">
          {cards}
        </ul>
      )}

      <div className="mx-auto max-w-6xl px-4 pb-[12vh]">
        <Link
          href="/events"
          className="text-base font-semibold underline-offset-4 hover:underline"
        >
          {t("landing.allEvents")}
        </Link>
      </div>
    </section>
  );
}
