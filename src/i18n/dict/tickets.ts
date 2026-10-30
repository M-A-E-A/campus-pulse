/**
 * Offline ticket wallet: the standalone full-screen ticket at
 * `/tickets/[rsvpId]` and the wallet entry points that link to it.
 * Key prefix: `ticket.`
 */
export const en = {
  "ticket.title": "Your ticket",
  "ticket.showAtDoor": "Show this at the door",
  "ticket.wakeLabel": "Keep the screen awake",
  "ticket.wakeHint": "Screen stays on while you're in the queue",
  "ticket.wakeUnsupported": "This browser can't keep the screen awake",
  "ticket.offlineBanner":
    "You're offline — showing the ticket saved on this device",
  "ticket.waitlistTitle": "You're on the waitlist",
  "ticket.waitlistBody":
    "No ticket yet. You're number {rank} — a spot frees up, you move in.",
  "ticket.backToEvent": "Back to the event",
  "ticket.fullScreen": "Full-screen ticket",
  "ticket.cancelled": "This RSVP is no longer valid",
  "ticket.cancelledBody":
    "The spot went back to the pool. Grab it again from the event page.",
  "ticket.forget": "Forget this device",
  "ticket.forgotten": "Saved ticket removed from this device",
  "ticket.save": "Save ticket",
  "ticket.saveHint":
    "In the print dialog, choose “Save as PDF” to keep a copy of this ticket.",
  "ticket.wallet": "Add to Apple Wallet",
  "ticket.walletNote":
    "Apple Wallet export isn’t configured on this server — use Save ticket for a PDF instead.",
  "ticket.walletError":
    "The Wallet pass couldn’t be generated. Use Save ticket instead.",
  "ticket.pass.eventLabel": "Event",
  "ticket.pass.dateLabel": "Date",
  "ticket.pass.locationLabel": "Location",
  "ticket.pass.clubLabel": "Club",
  "ticket.pass.codeLabel": "Ticket code",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "ticket.title": "Votre billet",
  "ticket.showAtDoor": "Présentez ceci à l'entrée",
  "ticket.wakeLabel": "Garder l'écran allumé",
  "ticket.wakeHint": "L'écran reste allumé pendant la file d'attente",
  "ticket.wakeUnsupported": "Ce navigateur ne peut pas garder l'écran allumé",
  "ticket.offlineBanner":
    "Vous êtes hors ligne — billet enregistré sur cet appareil",
  "ticket.waitlistTitle": "Vous êtes en liste d'attente",
  "ticket.waitlistBody":
    "Pas encore de billet. Vous êtes n° {rank} — une place se libère, vous entrez.",
  "ticket.backToEvent": "Retour à l'événement",
  "ticket.fullScreen": "Billet plein écran",
  "ticket.cancelled": "Cette inscription n'est plus valable",
  "ticket.cancelledBody":
    "La place est retournée au pool. Reprenez-la depuis la page de l'événement.",
  "ticket.forget": "Oublier cet appareil",
  "ticket.forgotten": "Billet enregistré retiré de cet appareil",
  "ticket.save": "Enregistrer le billet",
  "ticket.saveHint":
    "Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF » pour garder une copie de ce billet.",
  "ticket.wallet": "Ajouter à Apple Wallet",
  "ticket.walletNote":
    "L'export Apple Wallet n'est pas configuré sur ce serveur — utilisez « Enregistrer le billet » pour un PDF.",
  "ticket.walletError":
    "La passe Wallet n'a pas pu être générée. Utilisez « Enregistrer le billet » à la place.",
  "ticket.pass.eventLabel": "Événement",
  "ticket.pass.dateLabel": "Date",
  "ticket.pass.locationLabel": "Lieu",
  "ticket.pass.clubLabel": "Club",
  "ticket.pass.codeLabel": "Code billet",
};

export const ar: Record<keyof typeof en, string> = {
  "ticket.title": "تذكرتك",
  "ticket.showAtDoor": "اعرض هذا عند البوابة",
  "ticket.wakeLabel": "إبقاء الشاشة مضاءة",
  "ticket.wakeHint": "تبقى الشاشة مضاءة أثناء الوقوف في الطابور",
  "ticket.wakeUnsupported": "لا يدعم هذا المتصفح إبقاء الشاشة مضاءة",
  "ticket.offlineBanner": "أنت غير متصل — التذكرة محفوظة على هذا الجهاز",
  "ticket.waitlistTitle": "أنت في قائمة الانتظار",
  "ticket.waitlistBody":
    "لا تذكرة بعد. أنت رقم {rank} — إذا تحرّر مكان ستدخل.",
  "ticket.backToEvent": "العودة إلى الفعالية",
  "ticket.fullScreen": "تذكرة بملء الشاشة",
  "ticket.cancelled": "هذا التسجيل لم يعد صالحًا",
  "ticket.cancelledBody": "أُعيد المكان إلى القائمة. استعده من صفحة الفعالية.",
  "ticket.forget": "أنس هذا الجهاز",
  "ticket.forgotten": "أُزيلت التذكرة المحفوظة من هذا الجهاز",
  "ticket.save": "احفظ التذكرة",
  "ticket.saveHint":
    "في نافذة الطباعة، اختر «حفظ بصيغة PDF» للاحتفاظ بنسخة من هذه التذكرة.",
  "ticket.wallet": "أضف إلى محفظة أبل",
  "ticket.walletNote":
    "تصدير محفظة أبل غير مفعّل على هذا الخادم — استخدم «احفظ التذكرة» للحصول على ملف PDF.",
  "ticket.walletError":
    "تعذّر إنشاء تذكرة المحفظة. استخدم «احفظ التذكرة» بدلاً منها.",
  "ticket.pass.eventLabel": "الفعالية",
  "ticket.pass.dateLabel": "التاريخ",
  "ticket.pass.locationLabel": "المكان",
  "ticket.pass.clubLabel": "النادي",
  "ticket.pass.codeLabel": "رمز التذكرة",
};
