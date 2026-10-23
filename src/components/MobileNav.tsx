"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

export type MobileNavItem = { href: string; label: string };

/**
 * Compact menu for small screens (the desktop link row is hidden under md).
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
  const pathname = usePathname();
  const t = useT();

  // Any navigation closes the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        className="rounded-md p-2 text-ink hover:bg-line/50"
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
          className="absolute left-0 right-0 top-full border-b border-line bg-paper px-4 pb-4 pt-2 shadow-md"
        >
          <ul className="flex flex-col gap-0.5 text-sm font-medium">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-md px-3 py-2 hover:bg-line/50">
                  {item.label}
                </Link>
              </li>
            ))}
            {onLogout && (
              <li>
                <form action={onLogout}>
                  <button className="w-full rounded-md px-3 py-2 text-start text-muted hover:bg-line/50 hover:text-ink">
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
