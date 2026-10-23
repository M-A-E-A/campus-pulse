/**
 * Rotating anti-screenshot QR (boarding-pass style tickets).
 * Owner: batch agent D. Key prefix: `qr.`
 */
export const en = {
  "qr.hint": "The QR refreshes automatically — a screenshot won't work tomorrow",
  "qr.refreshing": "refreshing…",
  "qr.checkin.expired": "This QR has expired — ask for a fresh one or type the code",
  "qr.checkin.expiredItem": "expired QR",
  "qr.checkin.waitlisted": "{name} is on the waitlist — not a confirmed spot yet",
  "qr.checkin.waitlistedItem": "on the waitlist",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "qr.hint": "Le QR se rafraîchit automatiquement — une capture d'écran ne marchera pas demain",
  "qr.refreshing": "rafraîchissement…",
  "qr.checkin.expired": "Ce QR a expiré — demandez-en un nouveau ou saisissez le code",
  "qr.checkin.expiredItem": "QR expiré",
  "qr.checkin.waitlisted": "{name} est en liste d'attente — pas encore une place confirmée",
  "qr.checkin.waitlistedItem": "en liste d'attente",
};

export const ar: Record<keyof typeof en, string> = {
  "qr.hint": "يتجدد رمز QR تلقائيًا — لقطة الشاشة لن تعمل غدًا",
  "qr.refreshing": "جارٍ التحديث…",
  "qr.checkin.expired": "انتهت صلاحية رمز QR هذا — اطلب رمزًا جديدًا أو أدخل الرمز يدويًا",
  "qr.checkin.expiredItem": "رمز QR منتهي الصلاحية",
  "qr.checkin.waitlisted": "{name} في قائمة الانتظار — ليست مكانًا مؤكداً بعد",
  "qr.checkin.waitlistedItem": "في قائمة الانتظار",
};
