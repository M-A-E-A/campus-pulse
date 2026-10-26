"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

// Layout effect in the browser, plain effect during SSR (no server warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Load choreography for rebuilt pages: every [data-rise] element settles into
 * place with a stagger. The start state exists only in JS and only where
 * motion is allowed — first paint is already the finished layout, so the
 * reduced page is the finished page (nothing stays hidden waiting for an
 * animation that will not run).
 */
export function Entrance() {
  const started = useRef(false);
  useIsoLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = document.querySelectorAll<HTMLElement>("[data-rise]");
    if (!els.length) return;
    gsap.from(els, {
      y: 30,
      opacity: 0,
      duration: 0.55,
      ease: "power3.out",
      stagger: 0.06,
      delay: 0.05,
    });
  }, []);
  return null;
}
