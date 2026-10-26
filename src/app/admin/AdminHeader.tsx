import Link from "next/link";
import { getT } from "@/i18n/server";
import type { DictKey } from "@/i18n";

/**
 * Section chrome for `/admin`. The four admin pages each used to hand-roll this
 * nav with three different container widths, a different set of links (Clubs
 * and Categories were both missing Insights, so an admin on those pages could
 * not reach it) and a hard-coded accent colour that fails contrast once the
 * ground is ink. One component keeps the section coherent.
 *
 * The band is full-bleed; `width` must match the page's own content container
 * so the two share one canvas (otherwise their left edges visibly disagree).
 */
const SECTIONS: { href: string; key: DictKey }[] = [
  { href: "/admin", key: "admin.nav.queue" },
  { href: "/admin/clubs", key: "admin.nav.clubs" },
  { href: "/admin/categories", key: "admin.nav.categories" },
  { href: "/admin/insights", key: "admin.nav.insights" },
];

export async function AdminHeader({
  titleKey,
  active,
  width = "max-w-4xl",
}: {
  titleKey: DictKey;
  active: string;
  width?: string;
}) {
  const t = await getT();

  return (
    <div className="field-ink">
      <header className={`mx-auto px-4 py-7 ${width}`}>
        <h1 className="text-[27px] font-extrabold leading-tight tracking-tight md:text-[32px]">
          {t(titleKey)}
        </h1>
        <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {SECTIONS.map((section) => {
            const isCurrent = section.href === active;
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "whitespace-nowrap font-semibold text-accent"
                    : "whitespace-nowrap font-medium text-paper/70 hover:text-paper"
                }
              >
                {t(section.key)}
              </Link>
            );
          })}
        </nav>
      </header>
    </div>
  );
}
