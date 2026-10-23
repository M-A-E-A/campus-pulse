import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { EmsiStrip } from "@/components/landing/EmsiStrip";
import { UpcomingStrip } from "@/components/landing/UpcomingStrip";
import { getT } from "@/i18n/server";

// Upcoming events come from the database — render per request, never at build.
export const dynamic = "force-dynamic";

// Real EMSI links (from emsi.ma). Verified contact: 380 Bd Brahim Roudani,
// quartier Maarif, Casablanca — 05 22 64 66 00 — info.casa@emsi.ma.
const SOCIALS = [
  { label: "Facebook", href: "https://www.facebook.com/emsi.ma" },
  { label: "Instagram", href: "https://www.instagram.com/emsigroupe.officiel" },
  { label: "TikTok", href: "https://www.tiktok.com/@groupe.emsi" },
  {
    label: "YouTube",
    href: "https://www.youtube.com/channel/UC5BiOBai2N48ytbCRQWWqJw",
  },
];

const OFFICIAL_LINKS = [
  { key: "landing.footer.officialSite" as const, href: "https://emsi.ma" },
  {
    key: "landing.footer.brochure" as const,
    href: "https://emsi.ma/wp-content/uploads/2025/11/Brochure-EMSI.pdf",
  },
  { key: "landing.footer.clubsPage" as const, href: "https://emsi.ma/clubs-et-bde/" },
];

// Landing page: the one page with the heavy effects (Three.js hero,
// GSAP pinning, Lenis). Dashboards and forms stay animation-free.
export default async function HomePage() {
  const t = await getT();

  return (
    <SmoothScroll>
      <Hero />
      <HowItWorks />
      <EmsiStrip />
      <UpcomingStrip />

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-display text-lg font-bold">
              Campus<span className="text-accent-dark">Pulse</span>
              <span className="ms-1.5 text-xs font-semibold text-muted">· EMSI</span>
            </p>
            <p className="mt-3 max-w-xs text-sm text-muted">
              {t("landing.footer.tagline")}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              {t("landing.footer.contact")}
            </h2>
            <address className="mt-3 space-y-1.5 text-sm not-italic text-ink">
              <p>380, Bd Brahim Roudani — Quartier Maarif, Casablanca</p>
              <p>
                <a href="tel:+212522646600" className="hover:text-accent-dark">
                  +212 522 646 600
                </a>
              </p>
              <p>
                <a href="mailto:info.casa@emsi.ma" className="hover:text-accent-dark">
                  info.casa@emsi.ma
                </a>
              </p>
              <p className="text-muted">{t("landing.footer.hours")}</p>
            </address>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              {t("landing.footer.links")}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {OFFICIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-dark"
                  >
                    {t(link.key)} <span aria-hidden>↗</span>
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wider text-muted">
              {t("landing.footer.follow")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-dark"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-line py-5">
          <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted">
            {t("landing.footer.legal")}
          </p>
        </div>
      </footer>
    </SmoothScroll>
  );
}
