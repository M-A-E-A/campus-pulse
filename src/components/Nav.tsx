import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { getT } from "@/i18n/server";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav, type MobileNavItem } from "./MobileNav";

export async function Nav() {
  const [session, t] = await Promise.all([auth(), getT()]);
  const user = session?.user;

  const mobileItems: MobileNavItem[] = [
    { href: "/events", label: t("nav.events") },
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
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          Campus<span className="text-accent-dark">Pulse</span>
          <span className="ms-1.5 hidden text-xs font-semibold text-muted sm:inline">
            · EMSI
          </span>
        </Link>

        <div className="flex items-center gap-2 md:gap-1">
          <LanguageSwitcher />

          <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
            <Link href="/events" className="rounded-md px-3 py-1.5 hover:bg-line/50">
              {t("nav.events")}
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="rounded-md px-3 py-1.5 hover:bg-line/50">
                  {t("nav.myTickets")}
                </Link>
                {(user.role === "ORGANIZER" || user.role === "ADMIN") && (
                  <Link href="/organizer" className="rounded-md px-3 py-1.5 hover:bg-line/50">
                    {t("nav.organizer")}
                  </Link>
                )}
                {user.role === "ADMIN" && (
                  <Link href="/admin" className="rounded-md px-3 py-1.5 hover:bg-line/50">
                    {t("nav.admin")}
                  </Link>
                )}
                <form action={logoutAction}>
                  <button className="rounded-md px-3 py-1.5 text-muted hover:bg-line/50 hover:text-ink">
                    {t("nav.logout")}
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-md px-3 py-1.5 hover:bg-line/50">
                  {t("nav.login")}
                </Link>
                <Link
                  href="/register"
                  className="btn btn-primary ms-1 px-4! py-1.5! text-sm!"
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </nav>

          {/* Small screens: the same links behind a menu button. */}
          <MobileNav items={mobileItems} onLogout={user ? logoutAction : undefined} />
        </div>
      </div>
    </header>
  );
}
