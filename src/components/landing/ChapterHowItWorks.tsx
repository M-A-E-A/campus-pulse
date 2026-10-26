"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useT } from "@/i18n/provider";
import type { DictKey } from "@/i18n";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Chapter two (paper field): the flow — find, RSVP, ticket, review — as an
 * accordion of orange-tinted panels running dark to light, so the row reads
 * as one hue stepping toward the door. Pointer users skim the stages open
 * on hover; keyboard and touch use the buttons. On a phone the accordion
 * stands up as stacked bars, first stage open, exactly the same order.
 */
const STAGES: { titleKey: DictKey; textKey: DictKey; panel: string }[] = [
  { titleKey: "landing.how.s1t", textKey: "landing.how.s1x", panel: "bg-accent-deep text-paper" },
  { titleKey: "landing.how.s2t", textKey: "landing.how.s2x", panel: "bg-accent-dark text-white" },
  { titleKey: "landing.how.s3t", textKey: "landing.how.s3x", panel: "bg-accent text-ink" },
  { titleKey: "landing.how.s4t", textKey: "landing.how.s4x", panel: "bg-accent-soft text-ink" },
];

export function ChapterHowItWorks() {
  const root = useRef<HTMLElement>(null);
  const t = useT();
  const [open, setOpen] = useState(0);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from("[data-acc-rise]", {
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
        y: 28,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.08,
      });
    },
    { scope: root }
  );

  return (
    <section id="how" ref={root} className="field-paper scroll-mt-14">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-[12vh] md:grid-cols-12">
        <h2 data-acc-rise className="display-chapter md:col-span-5">
          {t("landing.how.title")}
        </h2>
        <p
          data-acc-rise
          className="text-[length:var(--step-lead)] md:col-span-5 md:col-start-8"
        >
          {t("landing.how.lead")}
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-[14vh]">
        <div data-acc-rise className="flex flex-col md:h-[520px] md:flex-row">
          {STAGES.map((s, i) => {
            const isOpen = open === i;
            const id = `how-stage-${i}`;
            return (
              <div
                key={s.titleKey}
                id={id}
                onMouseEnter={() => setOpen(i)}
                className={`${s.panel} acc-panel flex flex-col ${
                  isOpen
                    ? "flex-1 md:flex-[0_0_58%]"
                    : "basis-16 md:flex-none md:basis-[10.5%]"
                }`}
              >
                {/* Heading wraps the button (APG accordion pattern) so the
                    four stages enter the document outline. */}
                <h3 className={`m-0 flex w-full ${isOpen ? "" : "flex-1"}`}>
                  <button
                    type="button"
                    onClick={() => setOpen(i)}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-panel`}
                    className={`flex w-full text-start ${
                      isOpen ? "p-6 md:p-8" : "h-full items-end p-4 md:p-6"
                    }`}
                  >
                    <span
                      className={
                        isOpen
                          ? "text-2xl font-extrabold md:text-[40px]"
                          : "text-lg font-bold md:sliver-label md:text-lg"
                      }
                    >
                      {t(s.titleKey)}
                    </span>
                  </button>
                </h3>
                {/* Panel always exists so aria-controls never dangles. */}
                <p
                  id={`${id}-panel`}
                  hidden={!isOpen}
                  className="max-w-[36ch] p-6 pt-0 text-[length:var(--step-body)] md:my-auto md:p-8 md:pt-0"
                >
                  {t(s.textKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
