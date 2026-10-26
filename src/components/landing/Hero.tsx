"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useT } from "@/i18n/provider";

gsap.registerPlugin(useGSAP);

// The Three.js canvas never renders on the server.
const PulseCanvas = dynamic(() => import("./PulseCanvas"), {
  ssr: false,
  loading: () => null,
});

/**
 * Decides whether the dot field is worth loading: off for reduced motion,
 * off for weak devices (few cores / small screens), off as a safety net
 * if WebGL is missing. Everyone else gets the moving field on top of the
 * static SVG pulse line, so the hero never looks broken.
 */
function useShouldLoadScene() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => {
      const weak =
        (navigator.hardwareConcurrency ?? 8) < 4 ||
        window.innerWidth < 768 ||
        typeof WebGLRenderingContext === "undefined";
      setShouldLoad(!mq.matches && !weak);
    };
    evaluate();
    // The OS setting can flip while the tab is open: honour it live.
    mq.addEventListener("change", evaluate);
    return () => mq.removeEventListener("change", evaluate);
  }, []);

  return shouldLoad;
}

/**
 * Chapter one of the poster wall: the ink field. The two-line statement,
 * one primary action, the pulse strip, and the swatch column — the
 * navigation doubles as a preview of the page, each block the ground
 * colour of the chapter it points to. The sticky nav carries the name.
 */
export function Hero({ upcomingEvents }: { upcomingEvents: number }) {
  const loadScene = useShouldLoadScene();
  const t = useT();

  // The lines rise once, then the page is still. Runs once.
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from("[data-hero-line]", {
      y: 32,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.09,
      delay: 0.05,
    });
  }, []);

  const swatches = [
    { href: "#how", label: t("landing.how.title"), hint: t("landing.nav.howHint"), cls: "bg-paper text-ink" },
    { href: "#clubs", label: t("landing.nav.clubs"), hint: t("landing.nav.clubsHint"), cls: "bg-accent text-ink" },
    { href: "#deck", label: t("landing.comingUp"), hint: t("landing.nav.comingHint"), cls: "bg-paper text-ink" },
    { href: "/events", label: t("nav.events"), hint: t("landing.nav.eventsHint"), cls: "bg-accent-deep text-paper" },
    { href: "/register", label: t("nav.signup"), hint: t("landing.nav.signupHint"), cls: "bg-paper text-ink" },
  ];

  return (
    <section className="field-ink relative min-h-[92svh] overflow-hidden">
      {/* The floor: a static pulse line, visible with or without the canvas. */}
      <svg
        aria-hidden
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-[26%] h-20 w-full opacity-25"
      >
        <path
          d="M0 60 H380 l18-28 16 56 22-84 20 56 H760 l14-20 12 38 18-58 14 40 H1200"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
        />
      </svg>
      {loadScene && (
        <div aria-hidden className="absolute inset-0">
          <PulseCanvas />
        </div>
      )}

      {/* Desktop: the swatch column is the chapter index. */}
      <nav
        aria-label={t("landing.nav.chapters")}
        className="hero-rail absolute end-0 top-0 z-10 hidden h-full w-56 flex-col lg:flex"
      >
        {swatches.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`${s.cls} group flex flex-1 items-start justify-end p-5 text-base font-semibold transition-[filter] hover:brightness-95`}
          >
            <span className="text-end">
              <span className="block">{s.label}</span>
              {/* Hover / keyboard focus reveals what the chapter holds; under
                  reduced motion the hint stays visible (see .rail-hint). */}
              <span className="rail-hint mt-1 block text-sm font-medium">
                {s.hint}
              </span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="relative z-10 mx-auto flex min-h-[92svh] w-full max-w-6xl flex-col justify-between px-4 py-8 lg:pe-56">
        <div className="py-12">
          <h1 className="display-hero">
            <span data-hero-line className="block">
              {t("landing.hero.title1")}
            </span>
            <span data-hero-line className="block text-accent">
              {t("landing.hero.title2")}
            </span>
          </h1>
          <p data-hero-line className="mt-8 max-w-xl text-[length:var(--step-body)] text-paper/75">
            {t("landing.hero.sub")}
          </p>
          <div data-hero-line className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              href="/events"
              className="bg-accent px-8 py-3 text-base font-semibold text-ink transition-colors hover:bg-paper"
            >
              {t("landing.hero.browse")}
            </Link>
            <Link
              href="/register"
              className="text-base font-semibold text-paper underline-offset-4 hover:underline"
            >
              {t("landing.hero.signup")}
            </Link>
          </div>
        </div>

        {/* The live figure sits at the end of the content column, clear of
            the action row. Its own ink ground lets the pulse line run
            behind the label instead of through it. */}
        <div data-hero-line className="flex items-end justify-end">
          <div className="-mt-10 flex items-end gap-4 bg-ink pb-1 pt-10">
            <span className="display-chapter tabular-nums text-accent">
              {upcomingEvents}
            </span>
            <span className="mb-2 max-w-xs text-sm text-paper/70">
              {t("landing.pulse.label")}
            </span>
          </div>
        </div>
      </div>

      {/* Phone: the swatch column becomes five full-width bars. */}
      <nav
        aria-label={t("landing.nav.chapters")}
        className="relative z-10 flex flex-col lg:hidden"
      >
        {swatches.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`${s.cls} flex h-[52px] items-center px-4 text-base font-semibold`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
