"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useT } from "@/i18n/provider";
import type { DictKey } from "@/i18n";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEPS: { n: string; titleKey: DictKey; textKey: DictKey }[] = [
  { n: "01", titleKey: "landing.how.s1t", textKey: "landing.how.s1x" },
  { n: "02", titleKey: "landing.how.s2t", textKey: "landing.how.s2x" },
  { n: "03", titleKey: "landing.how.s3t", textKey: "landing.how.s3x" },
  { n: "04", titleKey: "landing.how.s4t", textKey: "landing.how.s4x" },
];

/**
 * The one pinned section on the landing page: the section sticks while four
 * steps crossfade. Everything else on the page scrolls normally — the brief
 * is explicit about not stacking effects.
 *
 * With reduced motion (or any small screen) there's no pinning at all:
 * the steps render as a plain grid.
 */
export function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  const t = useT();
  // Start with the animated version so the first client render matches the
  // server HTML (no hydration mismatch). Reduced-motion users switch to the
  // static grid right after mount, in the effect below.
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    setIsReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useGSAP(
    () => {
      // useGSAP runs in a layout effect, before the effect above flips
      // isReduced — so ask the media query directly. Pinning under reduced
      // motion would wrap the section in a pin-spacer and then get swapped
      // out from under it, leaving stale styles behind.
      if (
        isReduced ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=2500",
          pin: true,
          scrub: 0.6,
        },
      });

      // Steps 2..4 fade in, hold, fade out; step 1 fades out as 2 arrives.
      STEPS.forEach((_, i) => {
        const panel = `[data-step="${i}"]`;
        if (i === 0) {
          tl.to(panel, { opacity: 0, y: -30, duration: 0.5 }, 0.8);
        } else {
          tl.fromTo(
            panel,
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.5 },
            i
          );
          if (i < STEPS.length - 1) {
            tl.to(panel, { opacity: 0, y: -30, duration: 0.5 }, i + 0.8);
          }
        }
      });
    },
    { scope: root, dependencies: [isReduced] }
  );

  if (isReduced) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="text-3xl font-bold">{t("landing.how.title")}</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <p className="font-mono text-sm text-accent-dark">{s.n}</p>
              <h3 className="mt-1 text-xl font-semibold">{t(s.titleKey)}</h3>
              <p className="mt-2 text-muted">{t(s.textKey)}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={root} className="relative h-svh overflow-hidden bg-ink text-paper">
      <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-4">
        <p className="font-mono text-sm text-accent">{t("landing.how.title")}</p>
        <div className="relative mt-6 h-72">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              data-step={i}
              className="absolute inset-0 flex flex-col justify-center"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <p className="font-mono text-6xl text-accent sm:text-8xl">{s.n}</p>
              <h2 className="mt-2 text-4xl font-bold sm:text-6xl">{t(s.titleKey)}</h2>
              <p className="mt-4 max-w-xl text-lg text-paper/70">{t(s.textKey)}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex gap-2" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className="h-1 w-10 rounded-full bg-paper/25" />
          ))}
        </div>
      </div>
    </section>
  );
}
