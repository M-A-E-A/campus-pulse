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
  "auth.register.sub": "Everyone starts as a student. Clubs promote organizers.",
  "auth.register.submit": "Sign up",
  "auth.register.pending": "Creating account…",
  "auth.register.hasAccount": "Already have an account?",

  "auth.error.emailTaken": "An account with this email already exists.",
  "auth.error.invalidCredentials": "Invalid email or password.",
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
    "Tout le monde commence étudiant. Les clubs promeuvent des organisateurs.",
  "auth.register.submit": "S'inscrire",
  "auth.register.pending": "Création du compte…",
  "auth.register.hasAccount": "Vous avez déjà un compte ?",

  "auth.error.emailTaken": "Un compte avec cet e-mail existe déjà.",
  "auth.error.invalidCredentials": "E-mail ou mot de passe invalide.",
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
  "auth.register.sub": "الجميع يبدأ كطالب، والأندية ترقّي المنظمين.",
  "auth.register.submit": "إنشاء حساب",
  "auth.register.pending": "جارٍ إنشاء الحساب…",
  "auth.register.hasAccount": "لديك حساب بالفعل؟",

  "auth.error.emailTaken": "يوجد حساب بهذا البريد الإلكتروني مسبقاً.",
  "auth.error.invalidCredentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
};
