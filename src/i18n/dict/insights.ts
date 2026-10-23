/**
 * Admin insights: campus activity heatmap.
 * Owner: batch agent H. Key prefix: `ins.`
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
};
