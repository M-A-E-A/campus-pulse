import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { Hero } from "@/components/landing/Hero";
import { ChapterHowItWorks } from "@/components/landing/ChapterHowItWorks";
import { ProofMarquee } from "@/components/landing/ProofMarquee";
import { EventsDeck } from "@/components/landing/EventsDeck";
import { StatsChapter } from "@/components/landing/StatsChapter";
import { CtaTile } from "@/components/landing/CtaTile";
import { PulseMark } from "@/components/Logo";
import { getLandingStats, getUpcomingStrip } from "@/lib/queries";
import { getT, getLocale } from "@/i18n/server";

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

/**
 * Landing page: the poster wall. Six chapters, each a full-bleed flat
 * field butted edge to edge — the one page with the heavy effects
 * (Three.js dot field, GSAP pinning, Lenis). Dashboards and forms stay
 * animation-free.
 */
export default async function HomePage() {
  // Locale first: the strip's date labels are formatted in it.
  const locale = await getLocale();
  const [t, events, stats] = await Promise.all([
    getT(),
    getUpcomingStrip(locale),
    getLandingStats(),
  ]);

  return (
    <SmoothScroll>
      <Hero upcomingEvents={stats.upcomingEvents} />
      <ChapterHowItWorks />
      <ProofMarquee />
      <EventsDeck events={events} />
      <StatsChapter />
      <CtaTile />

      <footer className="field-ink">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <PulseMark className="h-5 w-5 text-accent" />
              campuspulse
              <span className="ms-1 text-sm font-semibold text-paper/60">· EMSI</span>
            </p>
            <p className="mt-3 max-w-xs text-sm text-paper/70">
              {t("landing.footer.tagline")}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-paper/60">
              {t("landing.footer.contact")}
            </h2>
            <address className="mt-3 space-y-1.5 text-sm not-italic text-paper/90">
              <p>380, Bd Brahim Roudani — Quartier Maarif, Casablanca</p>
              <p>
                <a href="tel:+212522646600" className="hover:text-accent">
                  +212 522 646 600
                </a>
              </p>
              <p>
                <a href="mailto:info.casa@emsi.ma" className="hover:text-accent">
                  info.casa@emsi.ma
                </a>
              </p>
              <p className="text-paper/60">{t("landing.footer.hours")}</p>
            </address>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-paper/60">
              {t("landing.footer.links")}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {OFFICIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent"
                  >
                    {t(link.key)} <span aria-hidden>↗</span>
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-sm font-semibold text-paper/60">
              {t("landing.footer.follow")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pb-6">
          <p className="mx-auto max-w-6xl px-4 text-sm text-paper/50">
            {t("landing.footer.legal")}
          </p>
        </div>
      </footer>
    </SmoothScroll>
  );
}
