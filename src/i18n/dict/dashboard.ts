/**
 * Student dashboard (my tickets / past events). Owner: batch agent B.
 * Key prefix: `dash.`
 */
export const en = {
  "dash.title": "My tickets",
  "dash.hi": "Hi {name} — here's what's coming up.",
  "dash.upcoming": "Upcoming",
  "dash.upcomingEmpty": "No RSVPs yet.",
  "dash.browseEvents": "Browse events",
  "dash.ticket": "Ticket",
  "dash.waitlisted": "Waitlist #{n}",
  "dash.waitlistHint": "You'll be promoted automatically if a spot frees.",
  "dash.saved": "Saved",
  "dash.savedEmpty": "Nothing saved yet. Hit “Save” on any event to keep it here.",
  "dash.past": "Past events",
  "dash.pastEmpty": "Nothing yet — events you RSVP to will land here afterwards.",
  "dash.attended": "Attended",
  "dash.notCheckedIn": "Not checked in",
  "dash.follows": "Clubs you follow",
  "dash.loading": "Loading your tickets",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "dash.title": "Mes billets",
  "dash.hi": "Salut {name} — voici ce qui arrive.",
  "dash.upcoming": "À venir",
  "dash.upcomingEmpty": "Aucune inscription pour l'instant.",
  "dash.browseEvents": "Voir les événements",
  "dash.ticket": "Billet",
  "dash.waitlisted": "Liste d'attente n°{n}",
  "dash.waitlistHint": "Vous serez promu automatiquement si une place se libère.",
  "dash.saved": "Enregistrés",
  "dash.savedEmpty":
    "Rien d'enregistré pour l'instant. Cliquez sur « Enregistrer » sur un événement pour le garder ici.",
  "dash.past": "Événements passés",
  "dash.pastEmpty":
    "Rien pour l'instant — les événements auxquels vous vous inscrivez apparaîtront ici ensuite.",
  "dash.attended": "Présent",
  "dash.notCheckedIn": "Non enregistré",
  "dash.follows": "Clubs que vous suivez",
  "dash.loading": "Chargement de vos billets",
};

export const ar: Record<keyof typeof en, string> = {
  "dash.title": "تذكراتي",
  "dash.hi": "مرحباً {name} — إليك ما يُنتظر.",
  "dash.upcoming": "الفعاليات القادمة",
  "dash.upcomingEmpty": "لا توجد تسجيلات حتى الآن.",
  "dash.browseEvents": "تصفح الفعاليات",
  "dash.ticket": "تذكرة",
  "dash.waitlisted": "قائمة الانتظار رقم {n}",
  "dash.waitlistHint": "ستتم ترقيتك تلقائياً عند توفر مكان.",
  "dash.saved": "المحفوظة",
  "dash.savedEmpty": "لا شيء محفوظ بعد. اضغط «حفظ» في أي فعالية لتعود إلى هنا.",
  "dash.past": "الفعاليات السابقة",
  "dash.pastEmpty": "لا شيء بعد — ستظهر هنا الفعاليات التي سجّلت فيها لاحقاً.",
  "dash.attended": "حضرت",
  "dash.notCheckedIn": "لم يُسجَّل الحضور",
  "dash.follows": "الأندية التي تتابعها",
  "dash.loading": "جارٍ تحميل تذكراتك",
};
