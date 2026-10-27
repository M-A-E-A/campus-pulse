import { getLocale } from "@/i18n/server";
import { getNotifications } from "@/lib/notifications-query";
import { NotificationBellClient } from "./NotificationBellClient";

/**
 * Server shell of the bell: it owns the per-user fetch (so that data never
 * reaches the client bundle as anything but the reader's own rows) and hands
 * plain props to the client half, which owns open/close and mark-read.
 *
 * `userId` arrives from Nav instead of calling auth() again — Nav already
 * read the session for this render. getLocale() is React-cached, so calling
 * it here costs nothing. Labels stay in the client, which reads them from the
 * I18nProvider that wraps <Nav /> in the root layout.
 *
 * The bell renders for every signed-in user even when there's nothing in it:
 * an empty state saying "you're all caught up" is how the feature gets found.
 */
export async function NotificationBell({ userId }: { userId: string }) {
  const locale = await getLocale();
  const { unreadCount, items } = await getNotifications(userId, locale);

  return <NotificationBellClient items={items} unreadCount={unreadCount} />;
}
