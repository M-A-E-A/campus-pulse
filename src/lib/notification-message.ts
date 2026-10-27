import type { T } from "@/i18n/index";
import type { NotificationType } from "@prisma/client";

export type NotificationMessageInput = {
  type: NotificationType;
  /** Reminder slot ("reminder:24h" / "reminder:1h") when the type is a reminder. */
  dedupeKey: string | null;
  /** Live data for the sentence — never stored on the row. */
  title: string | null;
  club: string | null;
};

/**
 * The sentence for one notification row, built AT READ TIME in the reader's
 * locale — shared by the bell (browser, viewer's locale) and the push
 * dispatcher (server, the device's stored locale) so a row can never read two
 * different ways in the same language.
 *
 * Deliberately data-only: it receives an already-bound `t`, never a dict, so
 * importing this from a client component pulls no dictionary into the bundle
 * (type-only import, erased at compile time).
 */
export function notificationMessage(t: T, n: NotificationMessageInput): string {
  const title = n.title ?? "";
  switch (n.type) {
    case "WAITLIST_PROMOTED":
      return t("notif.type.waitlist", { title });
    case "EVENT_REMINDER":
      // The slot lives in the dedupe key, so each pass reads differently.
      return t(n.dedupeKey === "reminder:1h" ? "notif.type.reminder1" : "notif.type.reminder24", {
        title,
      });
    case "EVENT_CANCELLED":
      return t("notif.type.cancelled", { title });
    case "NEW_CLUB_EVENT":
      return t("notif.type.newEvent", { title, club: n.club ?? "" });
    default:
      return t("notif.type.generic");
  }
}
