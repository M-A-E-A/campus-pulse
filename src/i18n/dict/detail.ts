/**
 * Event detail page: RSVP panel, ticket, save/follow, calendar. Owner: batch agent A.
 * Key prefix: `detail.`
 *
 * CONSTRAINTS (smoke test, do not change these EN values):
 *   "detail.rsvp.loginToRsvp"    → rendered pre-login CTA, must match /Log in to RSVP/
 *   "detail.rsvp.spotsTaken"     → capacity line, must match /spots taken/
 * The rsvp.* keys below are pre-seeded: rsvp-core returns them and the server
 * action translates them. Add display keys for the page on top of these.
 * ("detail.rsvp.full" is legacy: a full event now waitlists instead, but the
 * key stays for compatibility.)
 */
export const en = {
  "detail.rsvp.loginToRsvp": "Log in to RSVP",
  "detail.rsvp.spotsTaken": "{n} of {total} spots taken",
  "detail.rsvp.loginAction": "Log in to RSVP.",
  "detail.rsvp.loginFirst": "Log in first.",
  "detail.rsvp.full": "This event is full.",
  "detail.rsvp.alreadyGoing": "You're already going.",
  "detail.rsvp.notFound": "Event not found.",
  "detail.rsvp.closed": "RSVPs are closed for this event.",
  "detail.rsvp.alreadyDone": "You've already RSVP'd.",
  "detail.rsvp.error": "Something went wrong. Try again.",
  "detail.rsvp.done": "You're in! Your ticket is below.",
  "detail.rsvp.cancelled": "RSVP cancelled.",
  "detail.rsvp.waitlisted": "The event is full — you've joined the waitlist.",
  "detail.rsvp.alreadyWaitlisted": "You're already on the waitlist.",
  "detail.rsvp.waitlistBadge": "Waitlisted #{n}",
  "detail.rsvp.waitlistHint":
    "You'll be promoted automatically when a spot frees. Your dashboard will show your ticket then.",
  "detail.rsvp.onWaitlist": "{n} on the waitlist",
  "detail.rsvp.joinWaitlist": "Join the waitlist",
  "detail.rsvp.leaveWaitlist": "Leave the waitlist",

  // Page chrome
  "detail.meta.notFound": "Event not found",
  "detail.about": "About",
  "detail.organizer": "Organizer",
  "detail.openToAll": "Open to everyone",
  "detail.spotsTakenLabel": "Spots taken",
  "detail.spotsLeftOne": "{n} spot left",
  "detail.noSpotsLeft": "No spots left",
  "detail.addToCalendar": "Add to calendar (.ics)",
  "detail.seeTickets": "See all your tickets →",

  // RSVP panel (client)
  "detail.rsvp.wantToGo": "Want to go?",
  "detail.rsvp.loginPrompt": "Log in to RSVP and get your ticket.",
  "detail.rsvp.notYet": "You're not going yet.",
  "detail.rsvp.cta":
    "RSVP to lock your spot and get a QR ticket for the door.",
  "detail.rsvp.button": "RSVP",
  "detail.rsvp.busy": "RSVPing…",
  "detail.rsvp.joined": "You're in — your QR ticket is right below.",
  "detail.rsvp.cancelledReturn":
    "RSVP cancelled. The spot goes back to the pool.",

  // Ticket (client)
  "detail.ticket.going": "You're going",
  "detail.ticket.checkedIn": "Checked in",
  "detail.ticket.qrAlt": "QR code for ticket {code}",
  "detail.ticket.generating": "Generating QR…",
  "detail.ticket.showAtDoor": "Show this at the door.",
  "detail.ticket.saveQr": "Save QR image",
  "detail.ticket.alreadyCheckedIn": "You're already checked in",
  "detail.ticket.cancelling": "Cancelling…",
  "detail.ticket.cancel": "Cancel RSVP",

  // Save / follow (client)
  "detail.save.on": "★ Saved",
  "detail.save.off": "☆ Save",
  "detail.follow.on": "✓ Following club",
  "detail.follow.off": "+ Follow club",
  "detail.follow.unfollowedNote": "Unfollowed club",
  "detail.follow.followedNote":
    "Following club — their events will show first on your dashboard",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "detail.rsvp.loginToRsvp": "Connectez-vous pour vous inscrire",
  "detail.rsvp.spotsTaken": "{n} places prises sur {total}",
  "detail.rsvp.loginAction": "Connectez-vous pour vous inscrire.",
  "detail.rsvp.loginFirst": "Connectez-vous d'abord.",
  "detail.rsvp.full": "Cet événement est complet.",
  "detail.rsvp.alreadyGoing": "Vous y êtes déjà inscrit.",
  "detail.rsvp.notFound": "Événement introuvable.",
  "detail.rsvp.closed": "Les inscriptions sont closes pour cet événement.",
  "detail.rsvp.alreadyDone": "Vous êtes déjà inscrit.",
  "detail.rsvp.error": "Une erreur est survenue. Réessayez.",
  "detail.rsvp.done": "C'est confirmé ! Votre billet est ci-dessous.",
  "detail.rsvp.cancelled": "Inscription annulée.",
  "detail.rsvp.waitlisted": "L'événement est complet — vous êtes sur la liste d'attente.",
  "detail.rsvp.alreadyWaitlisted": "Vous êtes déjà sur la liste d'attente.",
  "detail.rsvp.waitlistBadge": "Liste d'attente n°{n}",
  "detail.rsvp.waitlistHint":
    "Vous serez promu automatiquement si une place se libère. Votre billet apparaîtra alors sur votre tableau de bord.",
  "detail.rsvp.onWaitlist": "{n} en liste d'attente",
  "detail.rsvp.joinWaitlist": "Rejoindre la liste d'attente",
  "detail.rsvp.leaveWaitlist": "Quitter la liste d'attente",

  "detail.meta.notFound": "Événement introuvable",
  "detail.about": "À propos",
  "detail.organizer": "Organisateur",
  "detail.openToAll": "Ouvert à tous",
  "detail.spotsTakenLabel": "Places prises",
  "detail.spotsLeftOne": "{n} place restante",
  "detail.noSpotsLeft": "Plus aucune place",
  "detail.addToCalendar": "Ajouter au calendrier (.ics)",
  "detail.seeTickets": "Voir tous vos billets →",

  "detail.rsvp.wantToGo": "Vous voulez y aller ?",
  "detail.rsvp.loginPrompt": "Connectez-vous pour vous inscrire et récupérer votre billet.",
  "detail.rsvp.notYet": "Vous n'êtes pas encore inscrit.",
  "detail.rsvp.cta":
    "Inscrivez-vous pour bloquer votre place et obtenir un billet QR pour l'entrée.",
  "detail.rsvp.button": "RSVP",
  "detail.rsvp.busy": "Inscription…",
  "detail.rsvp.joined": "C'est confirmé — votre billet QR est juste en dessous.",
  "detail.rsvp.cancelledReturn":
    "Inscription annulée. La place est remise en circulation.",

  "detail.ticket.going": "Vous y êtes inscrit",
  "detail.ticket.checkedIn": "Présent",
  "detail.ticket.qrAlt": "Code QR du billet {code}",
  "detail.ticket.generating": "Génération du QR…",
  "detail.ticket.showAtDoor": "Présentez ceci à l'entrée.",
  "detail.ticket.saveQr": "Enregistrer l'image QR",
  "detail.ticket.alreadyCheckedIn": "Vous êtes déjà enregistré",
  "detail.ticket.cancelling": "Annulation…",
  "detail.ticket.cancel": "Annuler l'inscription",

  "detail.save.on": "★ Enregistré",
  "detail.save.off": "☆ Enregistrer",
  "detail.follow.on": "✓ Club suivi",
  "detail.follow.off": "+ Suivre le club",
  "detail.follow.unfollowedNote": "Club non suivi",
  "detail.follow.followedNote":
    "Club suivi — leurs événements apparaîtront en premier sur votre tableau de bord",
};

export const ar: Record<keyof typeof en, string> = {
  "detail.rsvp.loginToRsvp": "سجّل الدخول للتسجيل",
  "detail.rsvp.spotsTaken": "تم أخذ {n} من {total} مكان",
  "detail.rsvp.loginAction": "سجّل الدخول للتسجيل.",
  "detail.rsvp.loginFirst": "سجّل الدخول أولاً.",
  "detail.rsvp.full": "هذا الحدث مكتمل العدد.",
  "detail.rsvp.alreadyGoing": "أنت مسجّل مسبقاً.",
  "detail.rsvp.notFound": "الفعالية غير موجودة.",
  "detail.rsvp.closed": "التسجيل مغلق لهذه الفعالية.",
  "detail.rsvp.alreadyDone": "لقد سجّلت حضورك مسبقاً.",
  "detail.rsvp.error": "حدث خطأ ما. حاول مجدداً.",
  "detail.rsvp.done": "تم التسجيل! تذكرتك في الأسفل.",
  "detail.rsvp.cancelled": "تم إلغاء التسجيل.",
  "detail.rsvp.waitlisted": "الفعالية مكتملة العدد — انضممت إلى قائمة الانتظار.",
  "detail.rsvp.alreadyWaitlisted": "أنت بالفعل في قائمة الانتظار.",
  "detail.rsvp.waitlistBadge": "قائمة الانتظار رقم {n}",
  "detail.rsvp.waitlistHint":
    "ستتم ترقيتك تلقائياً عند توفر مكان، وستظهر تذكرتك في لوحة التحكم.",
  "detail.rsvp.onWaitlist": "{n} في قائمة الانتظار",
  "detail.rsvp.joinWaitlist": "الانضمام إلى قائمة الانتظار",
  "detail.rsvp.leaveWaitlist": "مغادرة قائمة الانتظار",

  "detail.meta.notFound": "الفعالية غير موجودة",
  "detail.about": "نبذة",
  "detail.organizer": "المنظم",
  "detail.openToAll": "متاح للجميع",
  "detail.spotsTakenLabel": "الأماكن المحجوزة",
  "detail.spotsLeftOne": "بقيت {n} مكان واحد",
  "detail.noSpotsLeft": "لا توجد أماكن متاحة",
  "detail.addToCalendar": "إضافة إلى التقويم (.ics)",
  "detail.seeTickets": "عرض كل تذاكرك ←",

  "detail.rsvp.wantToGo": "هل تريد الحضور؟",
  "detail.rsvp.loginPrompt": "سجّل الدخول للتسجيل واحصل على تذكرتك.",
  "detail.rsvp.notYet": "لم تسجّل حضورك بعد.",
  "detail.rsvp.cta": "سجّل حضورك لحجز مكانك والحصول على تذكرة QR للمدخل.",
  "detail.rsvp.button": "RSVP",
  "detail.rsvp.busy": "جارٍ التسجيل…",
  "detail.rsvp.joined": "تم التسجيل — تذكرتك QR في الأسفل مباشرة.",
  "detail.rsvp.cancelledReturn":
    "تم إلغاء التسجيل. يعود المكان متاحاً للآخرين.",

  "detail.ticket.going": "أنت مسجّل",
  "detail.ticket.checkedIn": "تم تسجيل الحضور",
  "detail.ticket.qrAlt": "رمز QR للتذكرة {code}",
  "detail.ticket.generating": "جارٍ إنشاء رمز QR…",
  "detail.ticket.showAtDoor": "اعرض هذا عند المدخل.",
  "detail.ticket.saveQr": "حفظ صورة رمز QR",
  "detail.ticket.alreadyCheckedIn": "لقد سجّلت حضورك مسبقاً",
  "detail.ticket.cancelling": "جارٍ الإلغاء…",
  "detail.ticket.cancel": "إلغاء التسجيل",

  "detail.save.on": "★ محفوظ",
  "detail.save.off": "☆ حفظ",
  "detail.follow.on": "✓ تتابع النادي",
  "detail.follow.off": "+ متابعة النادي",
  "detail.follow.unfollowedNote": "تم إلغاء متابعة النادي",
  "detail.follow.followedNote":
    "تتابع النادي — ستظهر فعالياته أولاً في لوحة التحكم الخاصة بك",
};
