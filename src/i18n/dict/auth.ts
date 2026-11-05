/**
 * Login / register pages and forms. Owner: batch agent A.
 * Key prefix: `auth.`
 */
export const en = {
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.passwordHint": "At least 8 characters.",
  "auth.name": "Full name",

  "auth.login.title": "Welcome back",
  "auth.login.sub": "Log in to RSVP and manage your events.",
  "auth.login.submit": "Log in",
  "auth.login.pending": "Logging in…",
  "auth.login.noAccount": "No account?",

  "auth.register.title": "Create your account",
  "auth.register.sub": "Everyone starts as a student. Pick organizer from your next login.",
  "auth.register.submit": "Sign up",
  "auth.register.pending": "Creating account…",
  "auth.register.hasAccount": "Already have an account?",

  // Post-login crossroads (src/app/choose/page.tsx): shown on every sign-in
  // except admins, who skip it. The organizer card promotes on the spot.
  "auth.choose.title": "Student or event organizer?",
  "auth.choose.sub": "Choose the home you need. You can switch again every time you sign in.",
  "auth.choose.student.title": "Student",
  "auth.choose.student.blurb": "Browse events, RSVP, and keep every ticket in one place.",
  "auth.choose.student.cta": "Open my tickets",
  "auth.choose.organizer.title": "Event organizer",
  "auth.choose.organizer.blurb": "Create your club's events, check guests in, and track turnout.",
  "auth.choose.organizer.cta": "Open my events",

  "auth.error.emailTaken": "An account with this email already exists.",
  "auth.error.invalidCredentials": "Invalid email or password.",
  // Rate limit (rate-limit.ts): shown honestly AFTER the lockout; the raw
  // credential callback stays indistinguishable from a wrong password.
  "auth.error.tooManyAttempts": "Too many attempts. Try again in a few minutes.",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "auth.email": "E-mail",
  "auth.password": "Mot de passe",
  "auth.passwordHint": "Au moins 8 caractères.",
  "auth.name": "Nom complet",

  "auth.login.title": "Bon retour",
  "auth.login.sub": "Connectez-vous pour vous inscrire et gérer vos événements.",
  "auth.login.submit": "Se connecter",
  "auth.login.pending": "Connexion…",
  "auth.login.noAccount": "Pas encore de compte ?",

  "auth.register.title": "Créez votre compte",
  "auth.register.sub":
    "Tout le monde commence étudiant. Choisissez organisateur à votre prochaine connexion.",
  "auth.register.submit": "S'inscrire",
  "auth.register.pending": "Création du compte…",
  "auth.register.hasAccount": "Vous avez déjà un compte ?",

  "auth.choose.title": "Étudiant ou organisateur ?",
  "auth.choose.sub":
    "Choisissez l'accueil dont vous avez besoin. Vous pourrez changer à chaque connexion.",
  "auth.choose.student.title": "Étudiant",
  "auth.choose.student.blurb":
    "Parcourez les événements, inscrivez-vous et retrouvez tous vos billets.",
  "auth.choose.student.cta": "Ouvrir mes billets",
  "auth.choose.organizer.title": "Organisateur",
  "auth.choose.organizer.blurb":
    "Créez les événements de votre club, enregistrez les présences et suivez l'affluence.",
  "auth.choose.organizer.cta": "Ouvrir mes événements",

  "auth.error.emailTaken": "Un compte avec cet e-mail existe déjà.",
  "auth.error.invalidCredentials": "E-mail ou mot de passe invalide.",
  "auth.error.tooManyAttempts": "Trop de tentatives. Réessayez dans quelques minutes.",
};

export const ar: Record<keyof typeof en, string> = {
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.passwordHint": "8 أحرف على الأقل.",
  "auth.name": "الاسم الكامل",

  "auth.login.title": "مرحباً بعودتك",
  "auth.login.sub": "سجّل الدخول للتسجيل والتحكم في فعالياتك.",
  "auth.login.submit": "تسجيل الدخول",
  "auth.login.pending": "جارٍ تسجيل الدخول…",
  "auth.login.noAccount": "ليس لديك حساب؟",

  "auth.register.title": "أنشئ حسابك",
  "auth.register.sub": "الجميع يبدأ كطالب، واختر المنظم عند تسجيل دخولك القادم.",
  "auth.register.submit": "إنشاء حساب",
  "auth.register.pending": "جارٍ إنشاء الحساب…",
  "auth.register.hasAccount": "لديك حساب بالفعل؟",

  "auth.choose.title": "طالب أم منظم فعاليات؟",
  "auth.choose.sub": "اختر الصفحة الرئيسية التي تحتاجها. يمكنك التبديل في كل تسجيل دخول.",
  "auth.choose.student.title": "طالب",
  "auth.choose.student.blurb": "تصفّح الفعاليات، سجّل حضورك، واحتفظ بكل تذاكرك في مكان واحد.",
  "auth.choose.student.cta": "فتح تذاكري",
  "auth.choose.organizer.title": "منظم فعاليات",
  "auth.choose.organizer.blurb": "أنشئ فعاليات ناديك، سجّل حضور الضيوف، وتابع الإقبال.",
  "auth.choose.organizer.cta": "فتح فعالياتي",

  "auth.error.emailTaken": "يوجد حساب بهذا البريد الإلكتروني مسبقاً.",
  "auth.error.invalidCredentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth.error.tooManyAttempts": "محاولات كثيرة جداً. حاول مجدداً بعد دقائق.",
};
