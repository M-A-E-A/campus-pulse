/** Student scanner surface (/scan): the poster → event loop. Owner: main agent. */
export const en = {
  "scan.title": "Scan a QR code",
  "scan.sub":
    "Point the camera at a poster's QR code to open the event page.",
  "scan.cameraHint": "A QR printed on a poster opens the event directly.",
  "scan.startCamera": "Start camera",
  "scan.stopCamera": "Stop camera",
  "scan.cameraError": "Camera unavailable. Check your browser's permissions.",
  "scan.unknown": "That QR doesn't open an event on this site.",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "scan.title": "Scanner un QR",
  "scan.sub":
    "Dirigez la caméra vers le QR d'une affiche pour ouvrir la page de l'événement.",
  "scan.cameraHint": "Le QR imprimé sur une affiche ouvre directement l'événement.",
  "scan.startCamera": "Démarrer la caméra",
  "scan.stopCamera": "Arrêter la caméra",
  "scan.cameraError": "Caméra indisponible. Vérifiez les permissions du navigateur.",
  "scan.unknown": "Ce QR n'ouvre pas un événement du site.",
};

export const ar: Record<keyof typeof en, string> = {
  "scan.title": "مسح رمز QR",
  "scan.sub": "وجّه الكاميرا نحو رمز QR الموجود على ملصق لفتح صفحة الفعالية.",
  "scan.cameraHint": "رمز QR المطبوع على ملصق يفتح الفعالية مباشرة.",
  "scan.startCamera": "تشغيل الكاميرا",
  "scan.stopCamera": "إيقاف الكاميرا",
  "scan.cameraError": "الكاميرا غير متاحة. تحقق من أذونات المتصفح.",
  "scan.unknown": "لا يفتح رمز QR هذا أي فعالية على الموقع.",
};
