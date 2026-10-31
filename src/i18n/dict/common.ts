/** Shared strings: metadata, chrome, validation messages. Owner: main agent. */
export const en = {
  "meta.title": "Campus Pulse — every club event at EMSI",
  "meta.description":
    "Every club event at EMSI in one place. Find it, RSVP, get your ticket, scan in at the door.",
  "common.skipToContent": "Skip to content",
  "common.loading": "Loading…",
  "common.spotsLeft": "{n} spots left",
  // getUserMedia is blocked on plain http:// anywhere but localhost — the
  // venue demo runs off a LAN IP, which is exactly where cameras die.
  "common.cameraInsecure":
    "Camera unavailable: this page must be opened over HTTPS or localhost.",

  // Zod issue messages: the issue `message` IS one of these keys.
  "common.valid.nameMin2": "Name must be at least 2 characters",
  "common.valid.email": "Enter a valid email",
  "common.valid.passwordMin8": "Password must be at least 8 characters",
  "common.valid.passwordRequired": "Password is required",
  "common.valid.titleMin3": "Title must be at least 3 characters",
  "common.valid.eventDescMin10": "Describe the event in at least 10 characters",
  "common.valid.locationMin3": "Where is it?",
  "common.valid.startRequired": "Start time is required",
  "common.valid.endRequired": "End time is required",
  "common.valid.capacityPositive": "Capacity must be a positive number",
  "common.valid.categoryRequired": "Pick a category",
  "common.valid.endsAfterStart": "End time must be after the start time",
  "common.valid.scanRequired": "Scan or paste a ticket code",
  "common.valid.rejectReason": "Give a reason the organizer will see",
  "common.valid.clubDescMin10": "Describe the club in at least 10 characters",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "meta.title": "Campus Pulse — tous les événements des clubs de l'EMSI",
  "meta.description":
    "Tous les événements des clubs de l'EMSI au même endroit. Trouvez, inscrivez-vous, récupérez votre billet et faites scanner le QR à l'entrée.",
  "common.skipToContent": "Aller au contenu",
  "common.loading": "Chargement…",
  "common.spotsLeft": "{n} places restantes",
  "common.cameraInsecure":
    "Caméra indisponible : la page doit être ouverte en HTTPS ou sur localhost.",

  "common.valid.nameMin2": "Le nom doit contenir au moins 2 caractères",
  "common.valid.email": "Saisissez un e-mail valide",
  "common.valid.passwordMin8": "Le mot de passe doit contenir au moins 8 caractères",
  "common.valid.passwordRequired": "Le mot de passe est requis",
  "common.valid.titleMin3": "Le titre doit contenir au moins 3 caractères",
  "common.valid.eventDescMin10": "Décrivez l'événement en au moins 10 caractères",
  "common.valid.locationMin3": "Où se déroule-t-il ?",
  "common.valid.startRequired": "L'heure de début est requise",
  "common.valid.endRequired": "L'heure de fin est requise",
  "common.valid.capacityPositive": "La capacité doit être un nombre positif",
  "common.valid.categoryRequired": "Choisissez une catégorie",
  "common.valid.endsAfterStart": "L'heure de fin doit être après l'heure de début",
  "common.valid.scanRequired": "Scannez ou collez un code de billet",
  "common.valid.rejectReason": "Donnez une raison que l'organisateur verra",
  "common.valid.clubDescMin10": "Décrivez le club en au moins 10 caractères",
};

export const ar: Record<keyof typeof en, string> = {
  "meta.title": "Campus Pulse — كل فعاليات الأندية في مدرسة EMSI",
  "meta.description":
    "كل فعاليات الأندية في مدرسة EMSI في مكان واحد. اعثر عليها، سجّل حضورك، احصل على تذكرتك واعرض رمز QR عند المدخل.",
  "common.skipToContent": "الانتقال إلى المحتوى",
  "common.loading": "جارٍ التحميل…",
  "common.spotsLeft": "بقيت {n} أماكن",
  "common.cameraInsecure":
    "الكاميرا غير متاحة: يجب فتح الصفحة عبر HTTPS أو localhost.",

  "common.valid.nameMin2": "يجب أن يتكون الاسم من حرفين على الأقل",
  "common.valid.email": "أدخل بريداً إلكترونياً صالحاً",
  "common.valid.passwordMin8": "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل",
  "common.valid.passwordRequired": "كلمة المرور مطلوبة",
  "common.valid.titleMin3": "يجب أن يتكون العنوان من 3 أحرف على الأقل",
  "common.valid.eventDescMin10": "صف الفعالية بـ 10 أحرف على الأقل",
  "common.valid.locationMin3": "أين تُقام؟",
  "common.valid.startRequired": "وقت البدء مطلوب",
  "common.valid.endRequired": "وقت الانتهاء مطلوب",
  "common.valid.capacityPositive": "يجب أن يكون السعة رقماً موجباً",
  "common.valid.categoryRequired": "اختر فئة",
  "common.valid.endsAfterStart": "يجب أن يكون وقت الانتهاء بعد وقت البدء",
  "common.valid.scanRequired": "امسح أو الصق رمز التذكرة",
  "common.valid.rejectReason": "أدخل سبباً سيراه المنظم",
  "common.valid.clubDescMin10": "صف النادي بـ 10 أحرف على الأقل",
};
