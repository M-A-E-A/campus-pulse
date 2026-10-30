import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { getT } from "@/i18n/server";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ActiveLink } from "./ActiveLink";
import { MobileNav, type MobileNavItem } from "./MobileNav";
import { LogoutButton } from "./LogoutButton";
import { PulseMark } from "./Logo";
import { NotificationBell } from "./notifications/NotificationBell";

export async function Nav() {
  const [session, t] = await Promise.all([auth(), getT()]);
  const user = session?.user;

  const mobileItems: MobileNavItem[] = [
    { href: "/events", label: t("nav.events") },
    { href: "/clubs", label: t("nav.clubs") },
    ...(user
      ? [
          { href: "/dashboard", label: t("nav.myTickets") },
          ...((user.role === "ORGANIZER" || user.role === "ADMIN")
            ? [{ href: "/organizer", label: t("nav.organizer") }]
            : []),
          ...(user.role === "ADMIN" ? [{ href: "/admin", label: t("nav.admin") }] : []),
        ]
      : [
          { href: "/login", label: t("nav.login") },
          { href: "/register", label: t("nav.signup") },
        ]),
  ];

  return (
    <header className="sticky top-0 z-50 bg-paper">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight">
          <PulseMark className="h-5 w-5 text-accent" />
          campuspulse
          <span className="ms-1 hidden text-sm font-semibold text-muted sm:inline">
            · EMSI
          </span>
        </Link>

        <div className="flex items-center gap-2 md:gap-1">
          <LanguageSwitcher />

          <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
            <ActiveLink href="/events">{t("nav.events")}</ActiveLink>
            <ActiveLink href="/clubs">{t("nav.clubs")}</ActiveLink>
            {user ? (
              <>
                <ActiveLink href="/dashboard">{t("nav.myTickets")}</ActiveLink>
                {(user.role === "ORGANIZER" || user.role === "ADMIN") && (
                  <ActiveLink href="/organizer">{t("nav.organizer")}</ActiveLink>
                )}
                {user.role === "ADMIN" && (
                  <ActiveLink href="/admin">{t("nav.admin")}</ActiveLink>
                )}
                <LogoutButton className="px-3 py-1.5 text-muted hover:bg-line/60 hover:text-ink" />
              </>
            ) : (
              <>
                <ActiveLink href="/login">{t("nav.login")}</ActiveLink>
                <Link
                  href="/register"
                  className="btn btn-primary ms-1 px-4! py-1.5! text-sm!"
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </nav>

          {/* Signed-in only: the bell renders nothing for visitors. */}
          {user && <NotificationBell userId={user.id} />}

          {/* Small screens: the same links behind a menu button. */}
          <MobileNav items={mobileItems} onLogout={user ? logoutAction : undefined} />
        </div>
      </div>
    </header>
  );
}
