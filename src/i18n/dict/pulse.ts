/**
 * Live Pulse (SSE live check-in counter + projector door screen).
 * Owner: batch agent P. Key prefix: `pulse.`
 */
export const en = {
  // Attendees page → pulse screen link
  "pulse.open": "Live pulse",

  // Projector screen
  "pulse.title": "Live door counter",
  "pulse.live": "LIVE",
  "pulse.reconnecting": "reconnecting…",
  "pulse.checkedIn": "checked in",
  "pulse.ofCapacity": "of {capacity}",
  "pulse.confirmed": "{count} confirmed",
  "pulse.recent": "Latest at the door",
  "pulse.waiting": "Waiting for the first scan",
  "pulse.empty": "No scans yet — the counter is live",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "pulse.open": "Pulse en direct",
  "pulse.title": "Compteur d'entrée en direct",
  "pulse.live": "DIRECT",
  "pulse.reconnecting": "reconnexion…",
  "pulse.checkedIn": "présents",
  "pulse.ofCapacity": "sur {capacity}",
  "pulse.confirmed": "{count} confirmations",
  "pulse.recent": "Derniers passages à la porte",
  "pulse.waiting": "En attente du premier scan",
  "pulse.empty": "Aucun scan pour l'instant — le compteur est en direct",
};

export const ar: Record<keyof typeof en, string> = {
  "pulse.open": "النبض المباشر",
  "pulse.title": "عدّاد الدخول المباشر",
  "pulse.live": "مباشر",
  "pulse.reconnecting": "إعادة الاتصال…",
  "pulse.checkedIn": "من دخلوا",
  "pulse.ofCapacity": "من {capacity}",
  "pulse.confirmed": "{count} حجز مؤكَّد",
  "pulse.recent": "آخر من دخلوا الباب",
  "pulse.waiting": "في انتظار أول مسح",
  "pulse.empty": "لا مسح بعد — العداد يعمل مباشرة",
};
