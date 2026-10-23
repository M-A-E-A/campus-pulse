"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useT } from "@/i18n/provider";

gsap.registerPlugin(useGSAP);

type RecentEntry = { name: string; at: string };
type PulseState = {
  total: number;
  checkedIn: number;
  capacity: number | null;
  recent: RecentEntry[];
};

/**
 * Projector-friendly door display: one giant number, ticking live from the
 * SSE stream. This is a presentation surface, so the dashboard rule
 * ("no animation on data surfaces") doesn't apply here — the count-up is
 * the whole point of the demo. The global reduced-motion block in
 * globals.css plus the guard below still snap everything for anyone who
 * asked for less motion.
 */
export function PulseScreen({
  eventId,
  eventTitle,
  initial,
}: {
  eventId: string;
  eventTitle: string;
  initial: { total: number; checkedIn: number; capacity: number | null };
}) {
  const t = useT();
  const [state, setState] = useState<PulseState>({
    total: initial.total,
    checkedIn: initial.checkedIn,
    capacity: initial.capacity,
    recent: [],
  });
  const [reconnecting, setReconnecting] = useState(false);

  const counterRef = useRef<HTMLParagraphElement>(null);
  // last number actually painted — the count-up starts from here, so a tick
  // arriving mid-animation continues from what's on screen
  const shownRef = useRef(initial.checkedIn);

  useEffect(() => {
    const source = new EventSource(`/api/events/${eventId}/pulse`);

    source.onmessage = (event) => {
      try {
        setState(JSON.parse(event.data) as PulseState);
        setReconnecting(false);
      } catch {
        // a torn frame isn't worth blanking the screen over; next tick fixes it
      }
    };
    // EventSource reconnects on its own — we only surface the state.
    source.onerror = () => setReconnecting(true);

    return () => source.close();
  }, [eventId]);

  // Count-up on every increment. Reduced motion: set the number instantly.
  useGSAP(
    () => {
      const el = counterRef.current;
      if (!el) return;
      const target = state.checkedIn;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        shownRef.current = target;
        el.textContent = String(target);
        return;
      }

      const counter = { value: shownRef.current };
      gsap.to(counter, {
        value: target,
        duration: 0.6,
        ease: "power3.out",
        onUpdate: () => {
          const rounded = Math.round(counter.value);
          shownRef.current = rounded;
          el.textContent = String(rounded);
        },
        onComplete: () => {
          shownRef.current = target;
          el.textContent = String(target);
        },
      });
    },
    [state.checkedIn]
  );

  const pct =
    state.capacity !== null && state.capacity > 0
      ? Math.min(100, (state.checkedIn / state.capacity) * 100)
      : null;

  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center gap-8 bg-ink px-4 py-16 text-center text-paper">
      {/* The pulsing LIVE dot. One local keyframe pair instead of a Tailwind
          arbitrary animation so the class is greppable; globals.css already
          neutralizes it under prefers-reduced-motion. */}
      <style>{`
        @keyframes cp-pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }
        .cp-pulse-dot { animation: cp-pulse-dot 1.2s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-col items-center gap-4">
        <span className="inline-flex items-center gap-2.5 rounded-full border border-accent/60 bg-accent/15 px-5 py-2 text-sm font-bold uppercase tracking-[0.3em] text-accent">
          <span aria-hidden className="cp-pulse-dot block h-2.5 w-2.5 rounded-full bg-accent" />
          {t("pulse.live")}
        </span>
        {reconnecting && (
          <span role="status" className="text-xs uppercase tracking-[0.2em] text-paper/60">
            {t("pulse.reconnecting")}
          </span>
        )}
        <h1 className="text-xl font-semibold text-paper/80 sm:text-2xl">
          {/* sr-only prefix: the screen's own name, so a screen reader hears
              what this page is before the event title */}
          <span className="sr-only">{t("pulse.title")}: </span>
          {eventTitle}
        </h1>
      </div>

      <div className="flex flex-col items-center">
        <p
          ref={counterRef}
          className="text-[clamp(6rem,20vw,14rem)] font-bold leading-none tracking-tight tabular-nums"
        >
          {initial.checkedIn}
        </p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-paper/70">
          {t("pulse.checkedIn")}
        </p>
        {state.capacity !== null && (
          <p className="mt-2 text-lg text-paper/60">
            {t("pulse.ofCapacity", { capacity: state.capacity })}
          </p>
        )}
        {state.total > 0 && (
          <p className="mt-1 text-sm text-paper/50">
            {t("pulse.confirmed", { count: state.total })}
          </p>
        )}
        {pct !== null && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.capacity ?? 0}
            aria-valuenow={state.checkedIn}
            className="mt-5 h-1.5 w-72 max-w-full overflow-hidden rounded-full bg-paper/15"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {state.checkedIn === 0 && (
          <p className="mt-6 text-paper/50">{t("pulse.waiting")}</p>
        )}
      </div>

      <div className="w-full max-w-2xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-paper/50">
          {t("pulse.recent")}
        </h2>
        {state.recent.length === 0 ? (
          <p className="mt-3 text-sm text-paper/60">{t("pulse.empty")}</p>
        ) : (
          <ul className="mt-4 flex flex-wrap items-baseline justify-center gap-x-8 gap-y-3">
            {state.recent.map((entry) => (
              <li key={`${entry.name}-${entry.at}`} className="flex items-baseline gap-2.5">
                <span className="text-lg font-semibold">{entry.name}</span>
                <span className="text-sm tabular-nums text-paper/50">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
