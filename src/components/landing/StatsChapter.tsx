import { getLandingStats } from "@/lib/queries";
import { getT } from "@/i18n/server";

/**
 * Chapter five (ink field): one number, one screen. The figure is static
 * text — the sheet is explicit that it does not animate; the caption says
 * exactly what was measured and where it comes from.
 */
export async function StatsChapter() {
  const [stats, t] = await Promise.all([getLandingStats(), getT()]);

  return (
    <section className="field-ink flex min-h-[90svh] flex-col justify-between py-[10vh]">
      <div className="mx-auto w-full max-w-6xl px-4">
        <h2 className="display-chapter">{t("landing.stats.claim")}</h2>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4">
        {/* The exact figure, no "+": the caption promises every number on
            this page is real, and a superscript plus would contradict it. */}
        <p className="display-figure text-paper">
          {stats.confirmedRsvps.toLocaleString("en-GB")}
        </p>
        <p className="mt-8 max-w-[32ch] text-[length:var(--step-body)] text-paper/80">
          {t("landing.stats.caption")}
        </p>
      </div>
    </section>
  );
}
