import { getT } from "@/i18n/server";

/**
 * Real EMSI identity numbers, sourced from emsi.ma: 40+ years, 20 campuses,
 * 6 engineering departments. Sits between the how-it-works section and the
 * upcoming events strip.
 */
const STATS: { value: string; labelKey: "landing.stat.exp" | "landing.stat.campuses" | "landing.stat.departments" }[] = [
  { value: "40+", labelKey: "landing.stat.exp" },
  { value: "20+", labelKey: "landing.stat.campuses" },
  { value: "6", labelKey: "landing.stat.departments" },
];

export async function EmsiStrip() {
  const t = await getT();

  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <p className="mx-auto max-w-3xl text-center text-lg text-muted">
          {t("landing.emsi.about")}
        </p>
        <dl className="mt-10 grid grid-cols-3 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.value}>
              <dt className="font-display text-4xl font-bold text-accent-dark sm:text-5xl">
                {s.value}
              </dt>
              <dd className="mx-auto mt-2 max-w-[14rem] text-sm text-muted">
                {t(s.labelKey)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
