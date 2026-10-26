"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A nav link that marks the page you are on: `aria-current` for screen
 * readers, and the same ink chip the language switcher uses for its active
 * choice — "you are here" reads the same everywhere in the chrome.
 */
export function ActiveLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "bg-ink px-3 py-1.5 text-paper" : "px-3 py-1.5 hover:bg-line/60"}
    >
      {children}
    </Link>
  );
}
