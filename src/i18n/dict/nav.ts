/** Navigation chrome (desktop + mobile + language switcher). Owner: main agent. */
export const en = {
  "nav.events": "Events",
  "nav.myTickets": "My tickets",
  "nav.organizer": "Organizer",
  "nav.admin": "Admin",
  "nav.login": "Log in",
  "nav.signup": "Sign up",
  "nav.logout": "Log out",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.language": "Choose language",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "nav.events": "Événements",
  "nav.myTickets": "Mes billets",
  "nav.organizer": "Organisateur",
  "nav.admin": "Admin",
  "nav.login": "Connexion",
  "nav.signup": "S'inscrire",
  "nav.logout": "Déconnexion",
  "nav.openMenu": "Ouvrir le menu",
  "nav.closeMenu": "Fermer le menu",
  "nav.language": "Choisir la langue",
};

export const ar: Record<keyof typeof en, string> = {
  "nav.events": "الفعاليات",
  "nav.myTickets": "تذاكري",
  "nav.organizer": "المنظم",
  "nav.admin": "المسؤول",
  "nav.login": "تسجيل الدخول",
  "nav.signup": "إنشاء حساب",
  "nav.logout": "تسجيل الخروج",
  "nav.openMenu": "فتح القائمة",
  "nav.closeMenu": "إغلاق القائمة",
  "nav.language": "اختر اللغة",
};
