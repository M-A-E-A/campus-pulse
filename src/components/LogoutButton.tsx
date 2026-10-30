"use client";

import { logoutAction } from "@/lib/actions/auth";
import { purgeTicketCache } from "@/lib/ticket-cache";
import { useT } from "@/i18n/provider";

/**
 * Sign out, and take the offline ticket wallet with it.
 *
 * The service worker saves `/tickets/*` so a door works without wifi — but
 * that saved copy is a scannable credential. On a shared machine the thing
 * a student actually does is log out, so the purge belongs on that exact
 * button: the cache dies with the session instead of waiting for someone
 * else to trip over the URL. `purgeTicketCache` never throws, and it runs
 * on click (long before the server round-trip returns), so a storage-
 * blocked browser still signs out.
 */
export function LogoutButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={className}
        data-logout
        onClick={() => void purgeTicketCache()}
      >
        {t("nav.logout")}
      </button>
    </form>
  );
}
