/** In-app notification bell + the message each notification type renders as.
 *  Owner: main agent. Rows store a type; the sentence is built HERE at read
 *  time so the same row reads correctly in en, fr and ar. */
export const en = {
  "notif.bell": "Notifications",
  "notif.unread": "{count} unread",
  "notif.empty": "You're all caught up — nothing new.",
  "notif.markAll": "Mark all as read",
  "notif.markRead": "Mark as read",
  "notif.close": "Close notifications",
  "notif.new": "New",
  // One message per NotificationType. `{title}` (and `{club}`) are live data
  // pulled through the relation, never stored on the row.
  "notif.type.waitlist": "A seat opened up — you're in for {title}",
  "notif.type.reminder24": "Don't forget: {title}",
  "notif.type.reminder1": "Starting soon: {title}",
  "notif.type.cancelled": "{title} was cancelled",
  "notif.type.newEvent": "{club} published a new event: {title}",
  "notif.type.generic": "Update on an event you're following",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "notif.bell": "Notifications",
  "notif.unread": "{count} non lues",
  "notif.empty": "Vous êtes à jour — rien de nouveau.",
  "notif.markAll": "Tout marquer comme lu",
  "notif.markRead": "Marquer comme lu",
  "notif.close": "Fermer les notifications",
  "notif.new": "Nouveau",
  "notif.type.waitlist": "Une place s'est libérée — vous êtes inscrit à {title}",
  "notif.type.reminder24": "N'oubliez pas : {title}",
  "notif.type.reminder1": "Bientôt : {title}",
  "notif.type.cancelled": "{title} est annulé",
  "notif.type.newEvent": "{club} a publié un nouvel événement : {title}",
  "notif.type.generic": "Mise à jour d'un événement que vous suivez",
};

export const ar: Record<keyof typeof en, string> = {
  "notif.bell": "الإشعارات",
  "notif.unread": "{count} غير مقروءة",
  "notif.empty": "أنت على اطلاع — لا جديد.",
  "notif.markAll": "تعليم الكل كمقروء",
  "notif.markRead": "تعليم كمقروء",
  "notif.close": "إغلاق الإشعارات",
  "notif.new": "جديد",
  "notif.type.waitlist": "تاحذت مكانة — تم تسجيلك في {title}",
  "notif.type.reminder24": "لا تنسَ: {title}",
  "notif.type.reminder1": "يبدأ قريبًا: {title}",
  "notif.type.cancelled": "تم إلغاء {title}",
  "notif.type.newEvent": "{club} نشر فعالية جديدة: {title}",
  "notif.type.generic": "تحديث بخصوص فعالية تتابعها",
};
