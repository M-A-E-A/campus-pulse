/**
 * Clubs directory (`/clubs`) and the club profile (`/clubs/[id]`) — the
 * poster profiles: monogram, description, follower/upcoming/past counts,
 * and the follow toggle the event detail already speaks.
 * Key prefix: `clubs.`  (follow notes are reused from `detail.follow.*)
 */
export const en = {
  "clubs.title": "Clubs",
  "clubs.sub":
    "Every association on campus — who runs it, what it does, and what's next.",
  "clubs.searchPlaceholder": "Search clubs…",
  "clubs.searchLabel": "Search clubs",
  "clubs.count": "{shown} of {total} clubs",
  "clubs.clear": "Clear search",
  "clubs.empty": "No club matches that search.",
  "clubs.emptyAll": "No clubs have registered yet.",
  "clubs.statsUpcoming": "{n} upcoming",
  "clubs.next": "Next: {date}",
  "clubs.noEvents": "No upcoming events",
  "clubs.followers": "{n} followers",
  "clubs.statFollowers": "Followers",
  "clubs.statUpcoming": "Upcoming events",
  "clubs.statPast": "Past events",
  "clubs.eventsTitle": "Upcoming events",
  "clubs.noUpcoming":
    "Nothing on the calendar right now — follow to hear when something lands.",
  "clubs.followHint": "Follow to hear when they publish.",
  "clubs.backToAll": "All clubs",
  "clubs.metaTitle": "Clubs — Campus Pulse",
  "clubs.metaDescription":
    "The clubs of EMSI: profiles, next events, and who follows them.",
  "clubs.metaNotFound": "Club not found",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "clubs.title": "Clubs",
  "clubs.sub":
    "Toutes les associations du campus — qui les fait vivre, ce qu'elles font, et la suite.",
  "clubs.searchPlaceholder": "Rechercher un club…",
  "clubs.searchLabel": "Rechercher des clubs",
  "clubs.count": "{shown} sur {total} clubs",
  "clubs.clear": "Effacer la recherche",
  "clubs.empty": "Aucun club ne correspond à cette recherche.",
  "clubs.emptyAll": "Aucun club n'est encore inscrit.",
  "clubs.statsUpcoming": "{n} à venir",
  "clubs.next": "Prochain : {date}",
  "clubs.noEvents": "Aucun événement à venir",
  "clubs.followers": "{n} abonnés",
  "clubs.statFollowers": "Abonnés",
  "clubs.statUpcoming": "Événements à venir",
  "clubs.statPast": "Événements passés",
  "clubs.eventsTitle": "Événements à venir",
  "clubs.noUpcoming":
    "Rien au calendrier pour l'instant — suivez-les pour être prévenu.",
  "clubs.followHint": "Suivez-les pour savoir quand ils publient.",
  "clubs.backToAll": "Tous les clubs",
  "clubs.metaTitle": "Clubs — Campus Pulse",
  "clubs.metaDescription":
    "Les clubs de l'EMSI : profils, prochains événements et abonnés.",
  "clubs.metaNotFound": "Club introuvable",
};

export const ar: Record<keyof typeof en, string> = {
  "clubs.title": "الأندية",
  "clubs.sub": "كل جمعيات الحرم — من يحركها، ماذا تقدّم، وما الذي ينتظرها.",
  "clubs.searchPlaceholder": "ابحث عن نادٍ…",
  "clubs.searchLabel": "البحث عن الأندية",
  "clubs.count": "{shown} من {total} نادي",
  "clubs.clear": "مسح البحث",
  "clubs.empty": "لا يوجد نادٍ يطابق هذا البحث.",
  "clubs.emptyAll": "لم يسجّل أي نادٍ بعد.",
  "clubs.statsUpcoming": "{n} قادمة",
  "clubs.next": "القادم: {date}",
  "clubs.noEvents": "لا فعاليات قادمة",
  "clubs.followers": "{n} متابع",
  "clubs.statFollowers": "المتابعون",
  "clubs.statUpcoming": "فعاليات قادمة",
  "clubs.statPast": "فعاليات سابقة",
  "clubs.eventsTitle": "فعاليات قادمة",
  "clubs.noUpcoming": "لا شيء في البرنامج الآن — تابعهم لتُنبَّه عند نشر جديد.",
  "clubs.followHint": "تابعهم لتعرف متى ينشرون.",
  "clubs.backToAll": "كل الأندية",
  "clubs.metaTitle": "الأندية — Campus Pulse",
  "clubs.metaDescription": "أندية EMSI: الملفات، الفعاليات القادمة، والمتابعون.",
  "clubs.metaNotFound": "النادي غير موجود",
};
