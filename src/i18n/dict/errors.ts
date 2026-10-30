/**
 * error.tsx / not-found.tsx. Owner: batch agent A.
 * Key prefix: `errors.`
 */
export const en = {
  "errors.broke.title": "Something broke",
  "errors.broke.body":
    "Not your fault. Try again — if it keeps happening, the organizers already know about it.",
  "errors.broke.retry": "Try again",

  "errors.offline":
    "You're offline — reconnect, then try again.",

  "errors.notFound.title": "This page doesn't exist",
  "errors.notFound.body":
    "The link may be old, or the event was removed after it wrapped.",
  "errors.notFound.browse": "Browse events",
  "errors.notFound.home": "Back home",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "errors.broke.title": "Quelque chose a cassé",
  "errors.broke.body":
    "Ce n'est pas de votre faute. Réessayez — si ça continue, les organisateurs sont déjà au courant.",
  "errors.broke.retry": "Réessayer",

  "errors.offline":
    "Vous êtes hors connexion — reconnectez-vous, puis réessayez.",

  "errors.notFound.title": "Cette page n'existe pas",
  "errors.notFound.body":
    "Le lien est peut-être ancien, ou l'événement a été retiré après sa fin.",
  "errors.notFound.browse": "Parcourir les événements",
  "errors.notFound.home": "Retour à l'accueil",
};

export const ar: Record<keyof typeof en, string> = {
  "errors.broke.title": "حدث عطل ما",
  "errors.broke.body":
    "ليس خطأك. حاول مجدداً — وإن استمرت المشكلة، فالمنظمون يعرفون بالأمر.",
  "errors.broke.retry": "إعادة المحاولة",

  "errors.offline": "أنت غير متصل — أعد الاتصال ثم حاول مجدداً.",

  "errors.notFound.title": "هذه الصفحة غير موجودة",
  "errors.notFound.body": "قد يكون الرابط قديماً، أو حُذفت الفعالية بعد انتهائها.",
  "errors.notFound.browse": "تصفح الفعاليات",
  "errors.notFound.home": "العودة إلى الرئيسية",
};
