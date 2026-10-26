import { getClubNames } from "@/lib/queries";
import { getT } from "@/i18n/server";

/**
 * Chapter three: the proof band. Every club name at 8vw on a full-strength
 * orange field, cropped by both edges, drifting slowly (paused under
 * reduced motion). The sentence below says plainly who these names are —
 * followed by the real EMSI identity numbers, preserved from the old strip.
 */
export async function ProofMarquee() {
  const [clubs, t] = await Promise.all([getClubNames(), getT()]);
  if (clubs.length === 0) return null;

  const names = (ariaHidden: boolean) => (
    <span className="flex shrink-0 items-baseline" aria-hidden={ariaHidden || undefined}>
      {clubs.map((name, i) => (
        <span key={name} className="flex items-baseline">
          {i > 0 && (
            <span
              aria-hidden
              className="mx-[1.5vw] inline-block rounded-full bg-ink"
              style={{ width: "min(2vw, 1.5rem)", height: "min(2vw, 1.5rem)" }}
            />
          )}
          <span
            className="font-extrabold tracking-tight"
            style={{ fontSize: "min(8vw, 7rem)" }}
          >
            {name}
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <section id="clubs" className="scroll-mt-14">
      <div className="field-orange flex h-[34svh] min-h-56 items-center">
        <div className="marquee px-4">
          <div className="marquee-track">
            {names(false)}
            {names(true)}
          </div>
        </div>
      </div>

      <div className="field-paper">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-[length:var(--step-lead)]">{t("landing.proof.sentence")}</p>
          <p className="mt-4 max-w-2xl text-sm text-muted">{t("landing.emsi.about")}</p>
          <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
            {(
              [
                { v: "40+", k: "landing.stat.exp" },
                { v: "20+", k: "landing.stat.campuses" },
                { v: "6", k: "landing.stat.departments" },
              ] as const
            ).map((s) => (
              <div key={s.v} className="flex items-baseline gap-2">
                <dt className="text-4xl font-extrabold tabular-nums">{s.v}</dt>
                <dd className="max-w-[12rem] text-sm text-muted">{t(s.k)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
