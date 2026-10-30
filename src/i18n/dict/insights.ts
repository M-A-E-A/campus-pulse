/**
 * Admin insights: campus activity heatmap. Organizer analytics (`oins.`).
 * Owner: batch agent H. Key prefixes: `ins.`, `oins.`
 */
export const en = {
  "ins.header": "Campus insights",
  "ins.sub": "When campus activity peaks — plan scheduling around it.",
  "ins.gridTitle": "Attendance by weekday & hour (campus time)",

  // Summary stats
  "ins.stat.events": "Past events",
  "ins.stat.rsvps": "Confirmed RSVPs",
  "ins.stat.checkins": "Check-ins",
  "ins.stat.rate": "Show-up rate",

  // Heatmap cells + peak line
  "ins.cell": "{day} {start}–{end} · {events} events · {checkIns} check-ins",
  "ins.peak": "Busiest window: {day} {time}",

  // Legend
  "ins.legend.title": "Check-ins",
  "ins.legend.low": "Low",
  "ins.legend.high": "High",

  "ins.footnote":
    "Data covers the seeded semester: published events that already ended, from the last 120 days.",

  // Row labels (short weekday names, Mon → Sun display order)
  "ins.day.mon": "Mon",
  "ins.day.tue": "Tue",
  "ins.day.wed": "Wed",
  "ins.day.thu": "Thu",
  "ins.day.fri": "Fri",
  "ins.day.sat": "Sat",
  "ins.day.sun": "Sun",

  // Column labels (slot start hours, every 2 slots + the axis end)
  "ins.hour.00": "00",
  "ins.hour.04": "04",
  "ins.hour.08": "08",
  "ins.hour.12": "12",
  "ins.hour.16": "16",
  "ins.hour.20": "20",
  "ins.hour.22": "22",

  // Organizer analytics (/organizer/insights) — registration / velocity /
  // no-show blocks beneath the shared heatmap
  "oins.header": "Club insights",
  "oins.sub": "How your events performed — registrations, arrivals, no-shows.",
  "oins.empty": "No finished events yet — insights appear after your first event ends.",

  "oins.reg.title": "Registrations by week (last 4 months)",
  "oins.reg.peak": "Peak week: {week} · {count} registrations",
  "oins.reg.week": "Week of {week}: {count} registrations",

  "oins.vel.title": "Check-in velocity",
  "oins.vel.sub": "Minutes from the event start to the door scan",
  "oins.vel.before": "Before start",
  "oins.vel.0_15": "0–15 min",
  "oins.vel.15_30": "15–30 min",
  "oins.vel.30_60": "30–60 min",
  "oins.vel.60p": "60+ min",
  "oins.vel.peak": "Most scans: {bucket} · {count}",

  "oins.noshow.title": "No-shows by event",
  "oins.noshow.attended": "{attended} of {registered} came",
  "oins.noshow.rate": "{rate}% no-show",
} as const;

export const fr: Record<keyof typeof en, string> = {
  "ins.header": "Analyses du campus",
  "ins.sub": "Quand l'activité du campus culmine — planifiez en conséquence.",
  "ins.gridTitle": "Présences par jour et par heure (heure du campus)",

  "ins.stat.events": "Événements passés",
  "ins.stat.rsvps": "Inscriptions confirmées",
  "ins.stat.checkins": "Présences",
  "ins.stat.rate": "Taux de présence",

  "ins.cell": "{day} {start}–{end} · {events} événements · {checkIns} présences",
  "ins.peak": "Créneau le plus fréquenté : {day} {time}",

  "ins.legend.title": "Présences",
  "ins.legend.low": "Faible",
  "ins.legend.high": "Élevé",

  "ins.footnote":
    "Les données couvrent le semestre de démonstration : événements publiés déjà terminés, sur les 120 derniers jours.",

  "ins.day.mon": "Lun",
  "ins.day.tue": "Mar",
  "ins.day.wed": "Mer",
  "ins.day.thu": "Jeu",
  "ins.day.fri": "Ven",
  "ins.day.sat": "Sam",
  "ins.day.sun": "Dim",

  "ins.hour.00": "00",
  "ins.hour.04": "04",
  "ins.hour.08": "08",
  "ins.hour.12": "12",
  "ins.hour.16": "16",
  "ins.hour.20": "20",
  "ins.hour.22": "22",

  "oins.header": "Analyses du club",
  "oins.sub": "Le bilan de vos événements — inscriptions, arrivées, absences.",
  "oins.empty":
    "Aucun événement terminé pour l'instant — les analyses apparaissent après votre première édition.",

  "oins.reg.title": "Inscriptions par semaine (4 derniers mois)",
  "oins.reg.peak": "Semaine la plus active : {week} · {count} inscriptions",
  "oins.reg.week": "Semaine du {week} : {count} inscriptions",

  "oins.vel.title": "Vitesse d'entrée",
  "oins.vel.sub": "Minutes entre le début de l'événement et le scan à la porte",
  "oins.vel.before": "Avant le début",
  "oins.vel.0_15": "0–15 min",
  "oins.vel.15_30": "15–30 min",
  "oins.vel.30_60": "30–60 min",
  "oins.vel.60p": "60+ min",
  "oins.vel.peak": "La plupart des scans : {bucket} · {count}",

  "oins.noshow.title": "Absences par événement",
  "oins.noshow.attended": "{attended} présents sur {registered}",
  "oins.noshow.rate": "{rate}% d'absents",
};

export const ar: Record<keyof typeof en, string> = {
  "ins.header": "إحصاءات الحرم",
  "ins.sub": "متى يبلغ نشاط الحرم ذروته — خطط وفقاً لذلك.",
  "ins.gridTitle": "الحضور حسب اليوم والساعة (توقيت الحرم)",

  "ins.stat.events": "فعاليات سابقة",
  "ins.stat.rsvps": "تسجيلات مؤكدة",
  "ins.stat.checkins": "حضور",
  "ins.stat.rate": "نسبة الحضور",

  "ins.cell": "{day} {start}–{end} · {events} فعالية · {checkIns} حضور",
  "ins.peak": "أكثر الأوقات ازدحاماً: {day} {time}",

  "ins.legend.title": "الحضور",
  "ins.legend.low": "منخفض",
  "ins.legend.high": "مرتفع",

  "ins.footnote":
    "تغطي البيانات الفصل المزروع: الفعاليات المنشورة المنتهية، خلال آخر 120 يوماً.",

  "ins.day.mon": "الإثنين",
  "ins.day.tue": "الثلاثاء",
  "ins.day.wed": "الأربعاء",
  "ins.day.thu": "الخميس",
  "ins.day.fri": "الجمعة",
  "ins.day.sat": "السبت",
  "ins.day.sun": "الأحد",

  "ins.hour.00": "00",
  "ins.hour.04": "04",
  "ins.hour.08": "08",
  "ins.hour.12": "12",
  "ins.hour.16": "16",
  "ins.hour.20": "20",
  "ins.hour.22": "22",

  "oins.header": "إحصاءات النادي",
  "oins.sub": "أداء فعالياتك — التسجيلات والوصول والغياب.",
  "oins.empty": "لا توجد فعاليات منتهية بعد — تظهر الإحصاءات بعد انتهاء فعاليتك الأولى.",

  "oins.reg.title": "التسجيلات أسبوعياً (آخر 4 أشهر)",
  "oins.reg.peak": "أسبوع الذروة: {week} · {count} تسجيل",
  "oins.reg.week": "أسبوع {week}: {count} تسجيل",

  "oins.vel.title": "سرعة الدخول",
  "oins.vel.sub": "الدقائق بين بداية الفعالية والمسح عند الباب",
  "oins.vel.before": "قبل البدء",
  "oins.vel.0_15": "0–15 دقيقة",
  "oins.vel.15_30": "15–30 دقيقة",
  "oins.vel.30_60": "30–60 دقيقة",
  "oins.vel.60p": "60+ دقيقة",
  "oins.vel.peak": "معظم عمليات المسح: {bucket} · {count}",

  "oins.noshow.title": "الغياب حسب الفعالية",
  "oins.noshow.attended": "حضر {attended} من {registered}",
  "oins.noshow.rate": "{rate}% غياب",
};
