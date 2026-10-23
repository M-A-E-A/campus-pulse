/**
 * Admin area: approval queue, clubs, categories. Owner: batch agent B.
 * Key prefix: `admin.` — CONSTRAINT: EN "admin.queue.header" must contain
 * the literal substring "Waiting for approval" (smoke test assertion).
 */
export const en = {
  "admin.header": "Admin",
  "admin.nav.queue": "Approval queue",
  "admin.nav.clubs": "Clubs",
  "admin.nav.categories": "Categories",
  "admin.nav.insights": "Campus insights",

  // Approval queue
  "admin.queue.header": "Waiting for approval ({n})",
  "admin.queue.empty": "Queue is empty. Nothing to review.",
  "admin.queue.submitted": "submitted {date}",
  "admin.queue.capacity": " · capacity {n}",
  "admin.queue.preview": "Preview",
  "admin.queue.approve": "Approve & publish",

  // Reject form
  "admin.reject.open": "Reject…",
  "admin.reject.reasonLabel": "Reason (the organizer sees this)",
  "admin.reject.reasonPh":
    "e.g. Missing location — add a room number and resubmit.",
  "admin.reject.pending": "Rejecting…",
  "admin.reject.confirm": "Confirm rejection",
  "admin.reject.cancel": "Cancel",

  // Admin actions (server-side messages)
  "admin.action.categoryExists": "That category already exists.",
  "admin.action.clubExists": "A club with this name already exists.",
  "admin.action.noUser": "No user with that email. They must register first.",

  // Clubs
  "admin.clubs.header": "Clubs",
  "admin.clubs.count": "{events} events · {members} organizers",
  "admin.clubs.organizers": "Organizers:",
  "admin.clubs.newClub": "New club",
  "admin.clubs.namePh": "Club name",
  "admin.clubs.descPh": "What the club does",
  "admin.clubs.creating": "Creating…",
  "admin.clubs.createBtn": "Create club",
  "admin.clubs.promoteTitle": "Make someone an organizer",
  "admin.clubs.promoteHint":
    "They must already have an account (registered as a student).",
  "admin.clubs.emailPh": "student@univ.ma",
  "admin.clubs.pickClub": "Pick a club",
  "admin.clubs.promoting": "Promoting…",
  "admin.clubs.promoteBtn": "Promote to organizer",

  // Categories
  "admin.categories.header": "Categories",
  "admin.categories.addTitle": "Add a category",
  "admin.categories.count": "{n} events",
  "admin.categories.delete": "Delete",
  "admin.categories.ph": "e.g. Sports",
  "admin.categories.adding": "Adding…",
  "admin.categories.add": "Add",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "admin.header": "Admin",
  "admin.nav.queue": "File de validation",
  "admin.nav.clubs": "Clubs",
  "admin.nav.categories": "Catégories",
  "admin.nav.insights": "Analyses du campus",

  "admin.queue.header": "En attente de validation ({n})",
  "admin.queue.empty": "La file est vide. Rien à valider.",
  "admin.queue.submitted": "soumis le {date}",
  "admin.queue.capacity": " · capacité {n}",
  "admin.queue.preview": "Aperçu",
  "admin.queue.approve": "Approuver & publier",

  "admin.reject.open": "Rejeter…",
  "admin.reject.reasonLabel": "Raison (l'organisateur la verra)",
  "admin.reject.reasonPh":
    "ex. Lieu manquant — ajoutez un numéro de salle et renvoyez.",
  "admin.reject.pending": "Rejet en cours…",
  "admin.reject.confirm": "Confirmer le rejet",
  "admin.reject.cancel": "Annuler",

  "admin.action.categoryExists": "Cette catégorie existe déjà.",
  "admin.action.clubExists": "Un club portant ce nom existe déjà.",
  "admin.action.noUser":
    "Aucun utilisateur avec cet e-mail. Il doit d'abord s'inscrire.",

  "admin.clubs.header": "Clubs",
  "admin.clubs.count": "{events} événements · {members} organisateurs",
  "admin.clubs.organizers": "Organisateurs :",
  "admin.clubs.newClub": "Nouveau club",
  "admin.clubs.namePh": "Nom du club",
  "admin.clubs.descPh": "Ce que fait le club",
  "admin.clubs.creating": "Création…",
  "admin.clubs.createBtn": "Créer le club",
  "admin.clubs.promoteTitle": "Nommer quelqu'un organisateur",
  "admin.clubs.promoteHint":
    "Cette personne doit déjà avoir un compte (inscrite comme étudiant).",
  "admin.clubs.emailPh": "student@univ.ma",
  "admin.clubs.pickClub": "Choisissez un club",
  "admin.clubs.promoting": "Promotion en cours…",
  "admin.clubs.promoteBtn": "Promouvoir organisateur",

  "admin.categories.header": "Catégories",
  "admin.categories.addTitle": "Ajouter une catégorie",
  "admin.categories.count": "{n} événements",
  "admin.categories.delete": "Supprimer",
  "admin.categories.ph": "ex. Sport",
  "admin.categories.adding": "Ajout en cours…",
  "admin.categories.add": "Ajouter",
};

export const ar: Record<keyof typeof en, string> = {
  "admin.header": "المسؤولية",
  "admin.nav.queue": "قائمة المراجعة",
  "admin.nav.clubs": "الأندية",
  "admin.nav.categories": "الفئات",
  "admin.nav.insights": "إحصاءات الحرم",

  "admin.queue.header": "في انتظار المصادقة ({n})",
  "admin.queue.empty": "القائمة فارغة. لا شيء للمراجعة.",
  "admin.queue.submitted": "أُرسلت في {date}",
  "admin.queue.capacity": " · السعة {n}",
  "admin.queue.preview": "معاينة",
  "admin.queue.approve": "المصادقة والنشر",

  "admin.reject.open": "رفض…",
  "admin.reject.reasonLabel": "السبب (سيراه المنظم)",
  "admin.reject.reasonPh": "مثال: المكان ناقص — أضف رقم القاعة وأعد الإرسال.",
  "admin.reject.pending": "جارٍ الرفض…",
  "admin.reject.confirm": "تأكيد الرفض",
  "admin.reject.cancel": "إلغاء",

  "admin.action.categoryExists": "هذه الفئة موجودة بالفعل.",
  "admin.action.clubExists": "يوجد نادي بهذا الاسم بالفعل.",
  "admin.action.noUser": "لا يوجد مستخدم بهذا البريد. يجب أن يسجّل أولاً.",

  "admin.clubs.header": "الأندية",
  "admin.clubs.count": "{events} فعاليات · {members} منظمين",
  "admin.clubs.organizers": "المنظمون:",
  "admin.clubs.newClub": "نادٍ جديد",
  "admin.clubs.namePh": "اسم النادي",
  "admin.clubs.descPh": "ماذا يفعل النادي",
  "admin.clubs.creating": "جارٍ الإنشاء…",
  "admin.clubs.createBtn": "إنشاء النادي",
  "admin.clubs.promoteTitle": "ترقية شخص إلى منظم",
  "admin.clubs.promoteHint": "يجب أن يملك حساباً مسبقاً (مسجّل كطالب).",
  "admin.clubs.emailPh": "student@univ.ma",
  "admin.clubs.pickClub": "اختر نادياً",
  "admin.clubs.promoting": "جارٍ الترقية…",
  "admin.clubs.promoteBtn": "ترقية إلى منظم",

  "admin.categories.header": "الفئات",
  "admin.categories.addTitle": "إضافة فئة",
  "admin.categories.count": "{n} فعاليات",
  "admin.categories.delete": "حذف",
  "admin.categories.ph": "مثال: رياضة",
  "admin.categories.adding": "جارٍ الإضافة…",
  "admin.categories.add": "إضافة",
};
