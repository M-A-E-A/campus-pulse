// Seed script: demo accounts, real EMSI clubs, formations-as-categories, and
// realistic EMSI events (ETH hackathon, ERC robotics, BDE socials…).
// Run with: npm run db:seed
//
// Accounts (password for all: "password123"):
//   admin@campus.ma      - admin
//   organiser@campus.ma  - organizer (Club Innovation EMSI)
//   student@campus.ma    - student
//
// Idempotent: event upserts carry full `update` payloads (re-running refreshes
// content without touching RSVP rows), legacy demo clubs are renamed in place
// so foreign keys survive, and superseded generic categories are removed.
// Fixed event ids (seed-event-*) are relied on by the smoke test - keep them.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// All times below are UTC. 17:00 UTC = 17:00 (or 18:00, depending on DST)
// in Casablanca - the app displays everything through the campus zone.
function daysFromNow(days: number, hourUtc: number, minute = 0): Date {
  const d = new Date();
  d.setUTCHours(hourUtc, minute, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Mirror of daysFromNow for the seeded past semester (heatmap history). */
function daysAgo(days: number, hourUtc: number, minute = 0): Date {
  return daysFromNow(-days, hourUtc, minute);
}

/** Categories = the six EMSI formations + student-life catch-all (emsi.ma). */
const CATEGORY_NAMES = [
  "Ingénierie Informatique et Réseaux",
  "Génie Electrique et Systèmes Intelligents",
  "Ingénierie Automatisme et Informatique Industrielle",
  "Génie Civil BTP",
  "Génie Industriel",
  "Génie Financier",
  "Vie de campus",
] as const;

/** Generic categories from earlier demo versions - dropped once unreferenced. */
const LEGACY_CATEGORIES = ["Workshop", "Social", "Sports", "Career", "Culture"];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // ---- Users ----
  const admin = await prisma.user.upsert({
    where: { email: "admin@campus.ma" },
    update: {},
    create: { name: "Admin", email: "admin@campus.ma", passwordHash, role: "ADMIN" },
  });

  const organizer = await prisma.user.upsert({
    where: { email: "organiser@campus.ma" },
    update: {},
    create: { name: "Omar Organiser", email: "organiser@campus.ma", passwordHash, role: "ORGANIZER" },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@campus.ma" },
    update: {},
    create: { name: "Salma Student", email: "student@campus.ma", passwordHash, role: "STUDENT" },
  });

  // ---- Categories ----
  const categories: Record<string, string> = {};
  for (const name of CATEGORY_NAMES) {
    const c = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categories[name] = c.id;
  }

  // ---- Clubs ----
  // Real clubs from emsi.ma/clubs-et-bde. The three original demo clubs are
  // renamed in place (row id preserved → event/club-member FKs stay valid).
  await prisma.club.updateMany({
    where: { name: "Robotics Club" },
    data: {
      name: "Club Innovation EMSI",
      description:
        "Le club des makers de l'EMSI : robotique, hackathons et innovation matérielle (ETH, ERC, Smartilab).",
    },
  });
  await prisma.club.updateMany({
    where: { name: "Debate Society" },
    data: {
      name: "Enactus EMSI",
      description:
        "Entrepreneuriat social et projets à impact : concours nationaux, pitchs et missions de terrain.",
    },
  });
  await prisma.club.updateMany({
    where: { name: "Cinema Club" },
    data: {
      name: "BDE EMSI",
      description:
        "Le Bureau des Étudiants : vie de campus, événements culturels, séances et traditions du campus.",
    },
  });

  const clubData = [
    {
      name: "Club Innovation EMSI",
      description:
        "Le club des makers de l'EMSI : robotique, hackathons et innovation matérielle (ETH, ERC, Smartilab).",
    },
    {
      name: "Enactus EMSI",
      description:
        "Entrepreneuriat social et projets à impact : concours nationaux, pitchs et missions de terrain.",
    },
    {
      name: "BDE EMSI",
      description:
        "Le Bureau des Étudiants : vie de campus, événements culturels, séances et traditions du campus.",
    },
    {
      name: "Jeunes Leaders Marocains",
      description:
        "Leadership, prise de parole et débats : conférences, forums et rencontres inter-campus.",
    },
    {
      name: "Google Developer Student Clubs",
      description:
        "Communauté développeurs de l'EMSI : ateliers Android, Cloud et Web, et projets open source.",
    },
    {
      name: "Hult Prize EMSI",
      description:
        "Le plus grand concours étudiant de startup à impact social. Tournoi annuel sur campus.",
    },
    {
      name: "Club Sportif EMSI",
      description:
        "Tournois inter-écoles, entraînements et défis sportifs ouverts à tous les campus.",
    },
    {
      name: "Club des Échecs",
      description:
        "Parties rapides, initiations et tournois internes chaque semaine.",
    },
    {
      name: "Club de Lecture",
      description:
        "Rencontres lecture, cercles de discussion et auteurs invités.",
    },
  ];

  const clubs: Record<string, string> = {};
  for (const { name, description } of clubData) {
    const c = await prisma.club.upsert({
      where: { name },
      update: {},
      create: { name, description },
    });
    clubs[name] = c.id;
  }

  // Omar organizes Club Innovation (owns the workshops and tech events).
  await prisma.clubMember.upsert({
    where: { userId_clubId: { userId: organizer.id, clubId: clubs["Club Innovation EMSI"] } },
    update: {},
    create: { userId: organizer.id, clubId: clubs["Club Innovation EMSI"] },
  });

  // Salma follows two clubs and has one RSVP.
  await prisma.follow.upsert({
    where: { userId_clubId: { userId: student.id, clubId: clubs["Club Innovation EMSI"] } },
    update: {},
    create: { userId: student.id, clubId: clubs["Club Innovation EMSI"] },
  });
  await prisma.follow.upsert({
    where: { userId_clubId: { userId: student.id, clubId: clubs["Enactus EMSI"] } },
    update: {},
    create: { userId: student.id, clubId: clubs["Enactus EMSI"] },
  });

  // ---- Events ----
  // Every upsert carries the full payload so re-running the seed refreshes
  // titles/dates/assignments while keeping RSVP rows (FK on event id) intact.
  async function upsertEvent(data: {
    id: string;
    title: string;
    description: string;
    startsAt: Date;
    endsAt: Date;
    location: string;
    capacity: number | null;
    status: "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";
    clubId: string;
    categoryId: string;
  }) {
    // Demo coordinates per venue string (district-level Casablanca
    // approximations of the two campuses the demo uses). An unknown venue
    // stays null - an event whose room is "à confirmer" must not claim a
    // distance. Re-seeds refresh coords with the rest of the content.
    const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
      // EMSI Roudani cluster
      "Smartilab EMSI - Hall B, Campus Roudani": { lat: 33.5735, lng: -7.5879 },
      "Smartilab EMSI - Hall B": { lat: 33.5735, lng: -7.5879 },
      "Amphi EMSI Roudani": { lat: 33.5731, lng: -7.5898 },
      "Pelouse centrale - Campus Roudani": { lat: 33.5727, lng: -7.5903 },
      "Espace Innovation - EMSI Roudani, Casablanca": { lat: 33.5738, lng: -7.5887 },
      "Piste Smartilab - EMSI Roudani": { lat: 33.574, lng: -7.5874 },
      "Salle polyvalente - EMSI Roudani": { lat: 33.5729, lng: -7.5906 },
      "Salle info B2 - EMSI Roudani": { lat: 33.5733, lng: -7.5892 },
      "Campus Roudani - extérieur": { lat: 33.5725, lng: -7.5901 },
      // EMSI Maarif cluster
      "Amphi EMSI - Salle Atlas, Campus Maarif": { lat: 33.5715, lng: -7.6138 },
      "Salle des conférences - EMSI Maarif": { lat: 33.5717, lng: -7.6135 },
      "Médiathèque - EMSI Maarif": { lat: 33.5723, lng: -7.6128 },
      "Salle C1 - EMSI Maarif": { lat: 33.5714, lng: -7.6142 },
      // Off-campus
      "Complexe sportif - Casablanca": { lat: 33.5868, lng: -7.6054 },
    };
    const coords = VENUE_COORDS[data.location];
    const { id, ...content } = data;
    await prisma.event.upsert({
      where: { id },
      update: { ...content, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
      create: { ...data, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
    });
  }

  const lineFollowerId = "seed-event-line-follower";

  await upsertEvent({
    id: lineFollowerId,
    title: "Atelier robotique : construire un line-follower",
    description:
      "Session pratique : construisez et programmez un robot suiveur de ligne from scratch.\n\nMatériel fourni. Aucun prérequis : apportez votre curiosité et un portable si vous en avez un.",
    startsAt: daysFromNow(3, 17),
    endsAt: daysFromNow(3, 20),
    location: "Smartilab EMSI - Hall B, Campus Roudani",
    capacity: 60,
    status: "PUBLISHED",
    clubId: clubs["Club Innovation EMSI"],
    categoryId: categories["Ingénierie Automatisme et Informatique Industrielle"],
  });

  // The demo student's QR ticket (demo-ticket-code-0001) - used in the pitch,
  // plus two more confirmed RSVPs: the poster event's going-block names the
  // first two by RSVP date, and probe-going asserts the exact three-name line
  // (the FR plural "three" is exercised nowhere else). createdAt is staggered
  // so the order survives every re-seed: three rows written in the same
  // millisecond would tie, and the page and the probe's own query could then
  // disagree on the order and render different lines.
  const goingHours = [6, 3, 1];
  for (const [i, user] of [student, organizer, admin].entries()) {
    const createdAt = new Date(Date.now() - goingHours[i] * 3_600_000);
    await prisma.rsvp.upsert({
      where: { userId_eventId: { userId: user.id, eventId: lineFollowerId } },
      update: { createdAt },
      create: {
        userId: user.id,
        eventId: lineFollowerId,
        status: "CONFIRMED",
        ticketCode: `demo-ticket-code-000${i + 1}`,
        createdAt,
      },
    });
  }

  await upsertEvent({
    id: "seed-event-midnight-pitch",
    title: "Pitch de minuit - concours startup",
    description:
      "Pitchs de cinq minutes, un vrai jury, de vrais prix. Équipes de trois au maximum.\n\nCet événement traverse minuit volontairement : vérifiez l'affichage des dates.",
    startsAt: daysFromNow(7, 22),
    endsAt: daysFromNow(8, 2), // crosses midnight: good timezone test
    location: "Amphi EMSI - Salle Atlas, Campus Maarif",
    capacity: 120,
    status: "PUBLISHED",
    clubId: clubs["Enactus EMSI"],
    categoryId: categories["Vie de campus"],
  });

  await upsertEvent({
    id: "seed-event-open-air",
    title: "Cinéma en plein air : classiques marocains",
    description:
      "Couvertures sur la pelouse, projecteur sur le mur. Pop-corn offert tant que ça dure.",
    startsAt: daysFromNow(10, 19),
    endsAt: daysFromNow(10, 22),
    location: "Pelouse centrale - Campus Roudani",
    capacity: null, // unlimited
    status: "PUBLISHED",
    clubId: clubs["BDE EMSI"],
    categoryId: categories["Vie de campus"],
  });

  await upsertEvent({
    id: "seed-event-eth",
    title: "ETH 2026 - EMSI Tech Hackathon : Tech for Good",
    description:
      "Le hackathon techno de l'EMSI : 48 heures pour prototyper une solution à problème réel.\n\nBrief secret le vendredi, démo le dimanche devant un jury de l'industrie. Équipes de 2 à 4.",
    startsAt: daysFromNow(12, 8),
    endsAt: daysFromNow(14, 16),
    location: "Espace Innovation - EMSI Roudani, Casablanca",
    capacity: 100,
    status: "PUBLISHED",
    clubId: clubs["Club Innovation EMSI"],
    categoryId: categories["Ingénierie Informatique et Réseaux"],
  });

  await upsertEvent({
    id: "seed-event-erc",
    title: "EMSI Robotic Competition (ERC) - tours éliminatoires",
    description:
      "Les éliminatoires de l'ERC sur le terrain du Smartilab : courses de robots autonomes,\népreuves de précision et finale inter-campus. Venez soutenir votre campus.",
    startsAt: daysFromNow(17, 9),
    endsAt: daysFromNow(17, 18),
    location: "Piste Smartilab - EMSI Roudani",
    capacity: 150,
    status: "PUBLISHED",
    clubId: clubs["Club Innovation EMSI"],
    categoryId: categories["Ingénierie Automatisme et Informatique Industrielle"],
  });

  // One pending event so the admin queue isn't empty in the demo.
  await upsertEvent({
    id: "seed-event-pending",
    title: "Débat : l'IA en classe",
    description:
      "Débat ouvert sur l'usage des outils d'IA dans les travaux universitaires.\nVote du public à la fin.",
    startsAt: daysFromNow(5, 18),
    endsAt: daysFromNow(5, 20, 30),
    location: "Salle des conférences - EMSI Maarif",
    capacity: 40,
    status: "PENDING",
    clubId: clubs["Jeunes Leaders Marocains"],
    categoryId: categories["Ingénierie Informatique et Réseaux"],
  });

  // A draft so the organizer dashboard shows the full lifecycle.
  await upsertEvent({
    id: "seed-event-draft",
    title: "Initiation à la soudure (brouillon)",
    description: "Apprendre à souder sans rien brûler. La salle est encore à confirmer.",
    startsAt: daysFromNow(14, 16),
    endsAt: daysFromNow(14, 18),
    location: "À confirmer - Campus Roudani",
    capacity: 25,
    status: "DRAFT",
    clubId: clubs["Club Innovation EMSI"],
    categoryId: categories["Génie Electrique et Systèmes Intelligents"],
  });

  // ---- Past semester (data for the admin insights heatmap) ----
  // Published events that already happened, spread across weekdays and hours
  // with a realistic evening-heavy campus rhythm. Each carries RSVPs and
  // check-ins from the demo accounts so the heatmap has both event density
  // and attendance to show. Fixed ids keep re-runs idempotent.
  type PastEvent = {
    id: string;
    title: string;
    description: string;
    days: number;
    hourUtc: number;
    minute?: number;
    hours: number; // duration
    location: string;
    capacity: number | null;
    club: string;
    category: string;
  };

  const PAST_EVENTS: PastEvent[] = [
    { id: "seed-past-chess", title: "Tournoi d'échecs - finale inter-clubs", description: "Les rondes finales du tournoi inter-clubs, cadences rapides.", days: 63, hourUtc: 10, hours: 5, location: "Salle polyvalente - EMSI Roudani", capacity: 32, club: "Club des Échecs", category: "Vie de campus" },
    { id: "seed-past-git", title: "Atelier Git & GitHub", description: "Branches, pull requests, conflits : le git que l'on ne vous a pas enseigné.", days: 58, hourUtc: 17, hours: 2, location: "Salle info B2 - EMSI Roudani", capacity: 40, club: "Google Developer Student Clubs", category: "Ingénierie Informatique et Réseaux" },
    { id: "seed-past-cleanup", title: "Clean campus : collecte & plantation", description: "Collecte de déchets et plantation sur la pelouse centrale.", days: 56, hourUtc: 9, hours: 3, location: "Campus Roudani - extérieur", capacity: null, club: "BDE EMSI", category: "Vie de campus" },
    { id: "seed-past-alumni", title: "Soirée alumni - premiers pas dans l'industrie", description: "Trois alumni racontent leurs premiers mois en entreprise.", days: 51, hourUtc: 18, minute: 30, hours: 2, location: "Amphi EMSI Roudani", capacity: 80, club: "Jeunes Leaders Marocains", category: "Vie de campus" },
    { id: "seed-past-hult", title: "Hult Prize - tour de préparation", description: "Brief, pitchs relais et coaching devant le jury interne.", days: 47, hourUtc: 16, hours: 3, location: "Espace Innovation - EMSI Roudani", capacity: 50, club: "Hult Prize EMSI", category: "Génie Industriel" },
    { id: "seed-past-soldering", title: "Atelier soudure : premiers cordons", description: "Réglage du fer, étain, sécurité : vos premiers cordons de soudure.", days: 44, hourUtc: 15, hours: 2, location: "Smartilab EMSI - Hall B", capacity: 25, club: "Club Innovation EMSI", category: "Génie Electrique et Systèmes Intelligents" },
    { id: "seed-past-lecture", title: "Cercle de lecture - rencontre mensuelle", description: "Discussion ouverte autour du roman du mois, café et croissants.", days: 40, hourUtc: 17, minute: 30, hours: 2, location: "Médiathèque - EMSI Maarif", capacity: 20, club: "Club de Lecture", category: "Vie de campus" },
    { id: "seed-past-android", title: "Atelier Android Studio : première app", description: "De zéro à une application installée sur votre téléphone.", days: 37, hourUtc: 18, hours: 3, location: "Salle info B2 - EMSI Roudani", capacity: 45, club: "Google Developer Student Clubs", category: "Ingénierie Informatique et Réseaux" },
    { id: "seed-past-futsal", title: "Tournoi de futsal inter-écoles", description: "Phase de groupes et finales sur le terrain couvert.", days: 33, hourUtc: 15, hours: 4, location: "Complexe sportif - Casablanca", capacity: 60, club: "Club Sportif EMSI", category: "Vie de campus" },
    { id: "seed-past-pitch", title: "Pitch club : cinq équipes, un jury", description: "Le mensuel Enactus : cinq minutes par équipe, questions du jury.", days: 30, hourUtc: 19, hours: 3, location: "Amphi EMSI Roudani", capacity: 70, club: "Enactus EMSI", category: "Génie Financier" },
    { id: "seed-past-erc-prep", title: "ERC : calibration des robots", description: "Dernière session avant éliminatoires : capteurs, moteurs, parcours.", days: 26, hourUtc: 14, hours: 4, location: "Piste Smartilab - EMSI Roudani", capacity: 30, club: "Club Innovation EMSI", category: "Ingénierie Automatisme et Informatique Industrielle" },
    { id: "seed-past-cineclub", title: "Ciné-club : classiques du cinéma marocain", description: "Séance commentée suivie d'un échange avec un étudiant en histoire.", days: 21, hourUtc: 20, hours: 3, location: "Amphi EMSI Roudani", capacity: null, club: "BDE EMSI", category: "Vie de campus" },
    { id: "seed-past-finance", title: "Atelier modélisation financière", description: "Construire un modèle de cash-flow propre en Excel, pas à pas.", days: 14, hourUtc: 11, hours: 2, location: "Salle C1 - EMSI Maarif", capacity: 35, club: "Enactus EMSI", category: "Génie Financier" },
    { id: "seed-past-debate", title: "Débat : télétravail en stage, pour ou contre ?", description: "Débat structuré, deux camps, vote du public à la fin.", days: 7, hourUtc: 18, hours: 2, location: "Salle des conférences - EMSI Maarif", capacity: 45, club: "Jeunes Leaders Marocains", category: "Ingénierie Informatique et Réseaux" },
  ];

  for (const [i, e] of PAST_EVENTS.entries()) {
    const startsAt = daysAgo(e.days, e.hourUtc, e.minute ?? 0);
    await upsertEvent({
      id: e.id,
      title: e.title,
      description: e.description,
      startsAt,
      endsAt: daysAgo(e.days, e.hourUtc, (e.minute ?? 0) + e.hours * 60),
      location: e.location,
      capacity: e.capacity,
      status: "PUBLISHED",
      clubId: clubs[e.club],
      categoryId: categories[e.category],
    });

    // Attendance history: everyone RSVPs; a deterministic slice no-shows.
    const attendees = [admin, organizer, student];
    // Minutes from start to door scan, per (event, attendee) - spread across
    // every velocity bucket the insights chart reads (early → 60+ late).
    const SCAN_OFFSETS = [-12, 4, 15, 28, 47, 75];
    for (const [j, user] of attendees.entries()) {
      const attended = (i + j) % 4 !== 0; // ~75% show-up rate
      // People register in the days before the event - never at seed time.
      // Registration-over-time (organizer insights) and the attendees'
      // "RSVP date" column both read createdAt, so the dates have to sit
      // before startsAt: lead = 1..6 days ahead of the doors.
      const lead = 1 + ((i + j) % 6);
      const signupAt = new Date(startsAt.getTime() - lead * 24 * 60 * 60 * 1000);
      // checkedInAt rides in `update` too: upsertEvent refreshes startsAt
      // every run, and a stale check-in would drift before its event - the
      // organizers' velocity buckets read the difference.
      const checkInAt = attended
        ? new Date(startsAt.getTime() + SCAN_OFFSETS[(i + j) % 6] * 60_000)
        : null;
      await prisma.rsvp.upsert({
        where: { userId_eventId: { userId: user.id, eventId: e.id } },
        update: { createdAt: signupAt, checkedInAt: checkInAt },
        create: {
          userId: user.id,
          eventId: e.id,
          status: "CONFIRMED",
          ticketCode: `demo-past-${i + 1}-${j + 1}`,
          createdAt: signupAt,
          checkedInAt: checkInAt,
        },
      });
    }
  }

  // Post-event loop demo: the student already answered "yes, I'd go again"
  // to the soldering workshop she ATTENDED - so the dashboard's
  // recommendations are live from the first boot, while every other past
  // event stays unanswered and the thank-you screen still has its question.
  await prisma.rsvp.update({
    where: { userId_eventId: { userId: student.id, eventId: "seed-past-soldering" } },
    data: { attendAgain: true, feedbackAt: daysAgo(43, 12) },
  });

  // ---- Cleanup ----
  // Drop legacy generic categories once nothing references them (events above
  // have already moved onto the formations).
  await prisma.category.deleteMany({
    where: {
      name: { in: LEGACY_CATEGORIES },
      events: { none: {} },
    },
  });

  void admin; // role exists in the DB; kept for clarity
  console.log("Seeded (EMSI edition). Logins: admin@campus.ma / organiser@campus.ma / student@campus.ma (password123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
