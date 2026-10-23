"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useT } from "@/i18n/provider";

gsap.registerPlugin(useGSAP);

// The Three.js canvas never renders on the server.
const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => null,
});

/**
 * Decides whether the 3D scene is worth loading: off for reduced motion,
 * off for weak devices (few cores / small screens), off as a safety net
 * if WebGL is missing. Everyone else gets the scene plus a static
 * gradient behind it so the hero never looks broken.
 */
function useShouldLoadScene() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const weak =
      (navigator.hardwareConcurrency ?? 8) < 4 ||
      window.innerWidth < 768 ||
      typeof WebGLRenderingContext === "undefined";
    setShouldLoad(!reduced && !weak);
  }, []);

  return shouldLoad;
}

export function Hero() {
  const loadScene = useShouldLoadScene();
  const t = useT();

  // Headline: one reveal, then stop. Runs once.
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from("[data-hero-line]", {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: "power3.out",
      stagger: 0.12,
      delay: 0.1,
    });
  }, []);

  return (
    <section className="relative flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Static backdrop — also the no-WebGL / reduced-motion fallback. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-accent-soft),transparent_65%)]"
      />
      {loadScene && (
        <div aria-hidden className="absolute inset-0">
          <HeroScene />
        </div>
      )}

      <div className="relative z-10 max-w-3xl">
        <p data-hero-line className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-dark">
          {t("landing.hero.eyebrow")}
        </p>
        <h1 className="mt-4 text-5xl font-bold leading-[1.05] sm:text-7xl">
          <span data-hero-line className="block">{t("landing.hero.title1")}</span>
          <span data-hero-line className="block text-accent">{t("landing.hero.title2")}</span>
        </h1>
        <p data-hero-line className="mx-auto mt-6 max-w-xl text-lg text-muted">
          {t("landing.hero.sub")}
        </p>
        <div data-hero-line className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/events" className="btn btn-primary px-7! py-3! text-base!">
            {t("landing.hero.browse")}
          </Link>
          <Link href="/register" className="btn btn-secondary px-7! py-3! text-base!">
            {t("landing.hero.signup")}
          </Link>
        </div>
      </div>
    </section>
  );
}
