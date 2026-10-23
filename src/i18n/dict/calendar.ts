/**
 * Personal ICS calendar subscription feed.
 * Owner: main agent. Key prefix: `cal.`
 */
export const en = {
  "cal.title": "Add all your events to your calendar",
  "cal.desc":
    "One secret link subscribes any calendar app (Google, Apple, Outlook) to every event you RSVP to — new events appear automatically.",
  "cal.copy": "Copy link",
  "cal.copied": "Copied ✓",
  "cal.webcal": "Apple Calendar / Outlook",
  "cal.google": "Add to Google Calendar",
  "cal.googlePrefix": "Campus Pulse event",
  "cal.rotate": "Regenerate link",
  "cal.rotating": "Regenerating…",
  "cal.rotateWarning":
    "Regenerating disables the old link everywhere it was used.",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "cal.title": "Ajoutez tous vos événements à votre calendrier",
  "cal.desc":
    "Un lien secret s'abonne à tous vos événements inscrits depuis n'importe quelle appli de calendrier (Google, Apple, Outlook) — les nouveaux événements apparaissent automatiquement.",
  "cal.copy": "Copier le lien",
  "cal.copied": "Copié ✓",
  "cal.webcal": "Apple Calendar / Outlook",
  "cal.google": "Ajouter à Google Calendar",
  "cal.googlePrefix": "Événement Campus Pulse",
  "cal.rotate": "Régénérer le lien",
  "cal.rotating": "Régénération…",
  "cal.rotateWarning":
    "Régénérer désactive l'ancien lien partout où il a été utilisé.",
};

export const ar: Record<keyof typeof en, string> = {
  "cal.title": "أضف كل فعالياتك إلى تقويمك",
  "cal.desc":
    "رابط سري واحد يشترك به في كل فعالياتك المسجّلة من أي تطبيق تقويم (Google أو Apple أو Outlook) — وتظهر الفعاليات الجديدة تلقائياً.",
  "cal.copy": "نسخ الرابط",
  "cal.copied": "تم النسخ ✓",
  "cal.webcal": "Apple Calendar / Outlook",
  "cal.google": "إضافة إلى Google Calendar",
  "cal.googlePrefix": "فعالية Campus Pulse",
  "cal.rotate": "إعادة توليد الرابط",
  "cal.rotating": "جارٍ التوليد…",
  "cal.rotateWarning": "إعادة التوليد تُعطّل الرابط القديم في كل مكان استُخدم.",
};
