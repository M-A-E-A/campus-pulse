"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scrolling wired to GSAP's ticker — the two share one clock,
 * which is the only reliable way to keep ScrollTrigger in sync with Lenis:
 *   - Lenis drives rendering via gsap.ticker
 *   - every Lenis scroll tells ScrollTrigger to update
 * Skipped entirely when the user prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const lenis = new Lenis({ lerp: 0.12 });

    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // The OS setting can flip while the tab is open: stop smoothing live.
    // (No restart on flip-back — re-registering ScrollTrigger mid-session
    // is riskier than staying on native scroll.)
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
    mq.addEventListener("change", stop);

    return () => {
      mq.removeEventListener("change", stop);
      stop();
    };
  }, []);

  return <>{children}</>;
}
