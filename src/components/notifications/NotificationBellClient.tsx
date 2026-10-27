"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { notificationMessage } from "@/lib/notification-message";
import { PushToggle } from "@/components/pwa/PushToggle";
import { useT } from "@/i18n/provider";
import type { NotificationView } from "@/lib/notifications-query";

function BellIcon() {
  // Same house style as MobileNav's icons: inline stroke SVG, currentColor,
  // aria-hidden. Never an emoji — the design bans them outright.
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function NotificationBellClient({
  items,
  unreadCount,
}: {
  items: NotificationView[];
  unreadCount: number;
}) {
  const t = useT();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Optimistic layer: clear a dot the instant it's clicked, then let the
  // server's unreadCount confirm it. `pending` counts marks the server hasn't
  // reflected yet so the badge doesn't lie in between.
  const [pending, setPending] = useState(0);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [allRead, setAllRead] = useState(false);

  // When the server's count moves, its view is now authoritative — drop the
  // optimism so a mark is never subtracted twice (or kept after a refresh).
  useEffect(() => {
    setPending(0);
    setAllRead(false);
  }, [unreadCount]);

  // Disclosure dismissal: Escape returns focus to the trigger, and a click
  // anywhere outside the panel closes it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  const unread = allRead ? 0 : Math.max(0, unreadCount - pending);

  const markRead = (id: string) => {
    // Already marked (or the whole list was): no second round-trip.
    if (allRead || readIds.has(id) || !items.find((n) => n.id === id && !n.read)) return;
    setReadIds((prev) => new Set(prev).add(id));
    setPending((p) => p + 1);
    void markNotificationReadAction(id);
  };

  const markAll = () => {
    setAllRead(true);
    setPending(unreadCount);
    void markAllNotificationsReadAction();
  };

  const isRead = (n: NotificationView) => n.read || allRead || readIds.has(n.id);

  // The accessible name carries the count (the badge itself is aria-hidden
  // decoration), so screen-reader users hear "Notifications, 3 unread".
  const triggerLabel = unread > 0 ? `${t("notif.bell")} — ${t("notif.unread", { count: unread })}` : t("notif.bell");

  return (
    // `max-md:static` matters: below md the hamburger sits to the right of the
    // bell, so anchoring the panel to THIS box would push its left edge off
    // screen (measured: x = -30 at 390px). Making the wrapper static hands the
    // containing block to the sticky <header>, which spans the viewport — the
    // panel then gets end-4 as a guaranteed gutter at any phone width. From md
    // up the button is the last item in the nav, so relative + end-0 lines the
    // panel up under the bell exactly.
    <div className="relative max-md:static" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="relative flex h-9 w-9 items-center justify-center text-ink hover:bg-line/60"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls="notif-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center bg-accent px-1 text-[13px] font-bold leading-none text-ink"
            aria-hidden="true"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        // Poster framing, not glass: solid surface, a hard 2px ink rule and a
        // flat offset shadow — the same printed-panel language as the rest of
        // the redesign. Logical `end-0` keeps it anchored correctly in Arabic.
        <div
          id="notif-panel"
          className="absolute end-0 max-md:end-4 top-[calc(100%+8px)] z-50 w-[min(92vw,22rem)] border-2 border-ink bg-surface shadow-[5px_5px_0_var(--color-ink)]"
        >
          <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-paper px-3 py-2">
            <span className="text-sm font-extrabold tracking-tight">{t("notif.bell")}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-[13px] font-semibold text-accent-dark underline-offset-2 hover:underline"
              >
                {t("notif.markAll")}
              </button>
            )}
          </div>

          <ul className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-7 text-center text-[13px] text-muted">{t("notif.empty")}</li>
            ) : (
              items.map((n) => {
                const read = isRead(n);
                const body = (
                  <>
                    {/* Keeps the text column aligned whether or not there's a dot. */}
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 ${read ? "bg-transparent" : "bg-accent"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      {/* Unread state is also spelled out, never signalled by
                          colour alone. */}
                      {!read && <span className="sr-only">{t("notif.new")}</span>}
                      <span
                        className={`block text-[13px] ${read ? "text-muted" : "font-semibold text-ink"}`}
                      >
                        {notificationMessage(t, n)}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted">{n.timeLabel}</span>
                    </span>
                  </>
                );

                return (
                  <li key={n.id} className="border-b border-line last:border-b-0">
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => markRead(n.id)}
                        className="flex gap-3 px-3 py-3 hover:bg-paper"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="flex w-full gap-3 px-3 py-3 text-start hover:bg-paper"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Web-push switch for this device: offered inside the panel, where
              you're already reading notifications. Renders nothing where push
              can't work, so it never leaves a stray rule. */}
          <PushToggle />
        </div>
      )}
    </div>
  );
}
