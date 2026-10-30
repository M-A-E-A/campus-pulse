"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { purgeTicketCache } from "@/lib/ticket-cache";

export type MobileNavItem = { href: string; label: string };

/**
 * Compact menu for small screens (the desktop link row is hidden under lg —
 * md was too early: an organizer's row — events, clubs, tickets, management,
 * logout — overflowed the tablet viewport by 15px).
 * Closes itself on navigation and on Escape.
 */
export function MobileNav({
  items,
  onLogout,
}: {
  items: MobileNavItem[];
  onLogout?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const t = useT();

  // Any navigation closes the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Focus returns to the toggle so closing never strands the
        // keyboard user at the top of the document.
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        className="rounded-md p-3 text-ink hover:bg-line/50"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {open ? (
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          id="mobile-nav"
          className="absolute left-0 right-0 top-full border-b border-line bg-paper px-4 pb-4 pt-2"
        >
          <ul className="flex flex-col gap-0.5 text-sm font-medium">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "block rounded-md bg-ink px-3 py-2 text-paper"
                        : "block rounded-md px-3 py-2 hover:bg-line/50"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {onLogout && (
              <li>
                {/* Same purge as the desktop LogoutButton: sign-out is what
                    a shared machine's next student will hit, so the saved
                    ticket cache has to die here too. */}
                <form action={onLogout}>
                  <button
                    type="submit"
                    data-logout
                    className="w-full rounded-md px-3 py-2 text-start text-muted hover:bg-line/50 hover:text-ink"
                    onClick={() => void purgeTicketCache()}
                  >
                    {t("nav.logout")}
                  </button>
                </form>
              </li>
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
