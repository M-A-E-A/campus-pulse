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
import { CAMPUSES } from "../src/lib/geo";

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
  // The BDE now names its site (the directory carries one BDE per campus).
  // Two idempotent steps so any seed lineage lands on the same row while
  // its id, and with it every event and membership FK, survives: a database
  // still holding the generic "BDE EMSI" renames it here, an older one
  // holding the original "Cinema Club" renames in the second step, and a
  // fresh database simply creates the club in the loop below.
  await prisma.club.updateMany({
    where: { name: "BDE EMSI" },
    data: { name: "BDE EMSI Roudani" },
  });
  await prisma.club.updateMany({
    where: { name: "Cinema Club" },
    data: {
      name: "BDE EMSI Roudani",
      description:
        "Le Bureau des Étudiants : vie de campus, événements culturels, séances et traditions du campus.",
    },
  });

  // One BDE per campus, named after the site it runs. The Roudani entry
  // collides (on purpose) with the row renamed just above, so its upsert
  // updates in place. None of these descriptions may contain the word the
  // club search pins to Club Innovation alone.
  const bdeNameOf = (c: (typeof CAMPUSES)[number]) => c.name.replace("EMSI ", "BDE EMSI ");
  const bdeClubs = CAMPUSES.map((c) => ({
    name: bdeNameOf(c),
    description: `Le Bureau des Étudiants de ${c.name} : vie de campus, événements culturels et traditions locales.`,
  }));

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
    ...bdeClubs,
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

  // Campus id → its local BDE and its amphitheatre, the two things every
  // per-campus event below is assigned by. Both derive from src/lib/geo,
  // so a campus added there automatically gets a club, a venue and the
  // coordinates that venue maps to.
  const campusById: Record<string, (typeof CAMPUSES)[number]> = Object.fromEntries(
    CAMPUSES.map((c) => [c.id, c])
  );
  const bdeOf = (campusId: string) => clubs[bdeNameOf(campusById[campusId])];
  const amphitheatreOf = (campusId: string) => `Amphi ${campusById[campusId].name}`;

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
    // Demo coordinates per venue string. Every campus venue sits AT its own
    // campus centre (src/lib/geo is the single source of truth), so nearest-
    // campus grouping is exact and Hall B carries the very coordinates the
    // location probes stand at: a visitor there measures 0 km. An unknown
    // venue stays null - an event whose room is "à confirmer" must not claim
    // a distance. Re-seeds refresh coords with the rest of the content.
    const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
      // Every campus amphitheatre (the per-campus events below).
      ...Object.fromEntries(CAMPUSES.map((c) => [`Amphi ${c.name}`, { lat: c.lat, lng: c.lng }])),
      // EMSI Roudani rooms, all at the Roudani centre.
      "Smartilab EMSI - Hall B, Campus Roudani": { lat: 33.5815206, lng: -7.6338858 },
      "Smartilab EMSI - Hall B": { lat: 33.5815206, lng: -7.6338858 },
      "Pelouse centrale - Campus Roudani": { lat: 33.5815206, lng: -7.6338858 },
      "Espace Innovation - EMSI Roudani, Casablanca": { lat: 33.5815206, lng: -7.6338858 },
      "Piste Smartilab - EMSI Roudani": { lat: 33.5815206, lng: -7.6338858 },
      "Salle polyvalente - EMSI Roudani": { lat: 33.5815206, lng: -7.6338858 },
      "Salle info B2 - EMSI Roudani": { lat: 33.5815206, lng: -7.6338858 },
      "Campus Roudani - extérieur": { lat: 33.5815206, lng: -7.6338858 },
      // EMSI Maarif rooms, all at the Maarif centre.
      "Amphi EMSI - Salle Atlas, Campus Maarif": { lat: 33.583699, lng: -7.642437 },
      "Salle des conférences - EMSI Maarif": { lat: 33.583699, lng: -7.642437 },
      "Médiathèque - EMSI Maarif": { lat: 33.583699, lng: -7.642437 },
      "Salle C1 - EMSI Maarif": { lat: 33.583699, lng: -7.642437 },
      // Off-campus (the inter-school futsal tournament).
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
    clubId: clubs["BDE EMSI Roudani"],
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

  // ---- One event per remaining campus (the national wall) ----
  // Each of the other 17 sites hosts something soon, so every campus in
  // src/lib/geo appears on the wall, on the map and in the campus select.
  // The constraints are the probes': day 4 or later so the day-3 workshop
  // stays the wall's first card, never at Campus Maarif (the Pitch is the
  // only event that campus claims), never the word the map probe searches
  // for, and always the amphitheatre AT the campus centre so nearest-
  // campus grouping and the km labels land exactly on the site.
  type CampusEvent = {
    id: string;
    campus: string;
    title: string;
    description: string;
    days: number;
    hourUtc: number;
    capacity: number | null;
    category: string;
  };

  const CAMPUS_EVENTS: CampusEvent[] = [
    { id: "seed-campus-casa-anfa", campus: "casa-anfa", title: "Journée portes ouvertes", description: "Visitez les salles, rencontrez les clubs et échangez avec les équipes pédagogiques du campus.\n\nEntrée libre, venez comme vous êtes.", days: 4, hourUtc: 17, capacity: 90, category: "Vie de campus" },
    { id: "seed-campus-rabat-centre-2", campus: "rabat-centre-2", title: "Rencontre avec les alumni", description: "Trois diplômés racontent leur première année après l'EMSI et répondent à vos questions.\n\nPlaces limitées, inscription sur place.", days: 4, hourUtc: 18, capacity: 70, category: "Vie de campus" },
    { id: "seed-campus-tanger", campus: "tanger", title: "Soirée culturelle du détroit", description: "Poésie, musique et courts métrages étudiants pour ouvrir le semestre au campus de Tanger.\n\nEntrée libre.", days: 5, hourUtc: 18, capacity: 90, category: "Vie de campus" },
    { id: "seed-campus-moulay-youssef", campus: "moulay-youssef", title: "Soirée d'accueil des nouveaux", description: "Le BDE accueille la nouvelle promotion : jeux, musique et présentation des associations du campus.\n\nTout le monde est invité.", days: 6, hourUtc: 17, capacity: 100, category: "Vie de campus" },
    { id: "seed-campus-rabat-hassan", campus: "rabat-hassan", title: "Métiers du numérique", description: "Une heure avec des professionnels du secteur pour parler métiers, stages et premiers pas dans l'industrie.\n\nQuestions ouvertes à la fin.", days: 6, hourUtc: 18, capacity: 60, category: "Ingénierie Informatique et Réseaux" },
    { id: "seed-campus-centre-1", campus: "centre-1", title: "Atelier CV et entretien", description: "Rédigez un CV qui passe les filtres et simulez un entretien en binôme.\n\nApportez votre ordinateur si vous en avez un.", days: 8, hourUtc: 16, capacity: 35, category: "Vie de campus" },
    { id: "seed-campus-rabat-souissi", campus: "rabat-souissi", title: "Marché des associations", description: "Les associations du campus présentent leurs projets de l'année et recrutent de nouveaux membres.\n\nEntrée libre.", days: 8, hourUtc: 18, capacity: 80, category: "Vie de campus" },
    { id: "seed-campus-centre-2", campus: "centre-2", title: "Quiz inter-campus", description: "Six manches, des équipes mixtes et un classement en direct entre les campus.\n\nÉquipes de quatre, inscription sur place.", days: 9, hourUtc: 17, capacity: 60, category: "Vie de campus" },
    { id: "seed-campus-fes", campus: "fes", title: "Visite des ateliers de Fès", description: "Découverte des salles techniques du campus et démonstrations par les étudiants avancés.\n\nChaussures fermées conseillées.", days: 9, hourUtc: 18, capacity: 40, category: "Génie Industriel" },
    { id: "seed-campus-les-orangers", campus: "les-orangers", title: "Tournoi de ping-pong", description: "Tableaux ouverts pour les débutants et les confirmés, finale en soirée.\n\nRaquettes prêtées sur place, entrée libre.", days: 11, hourUtc: 17, capacity: 32, category: "Vie de campus" },
    { id: "seed-campus-rabat-centre-1", campus: "rabat-centre-1", title: "Atelier prise de parole", description: "Préparez un discours de trois minutes et repartez avec un plan de progression.\n\nPlaces limitées.", days: 11, hourUtc: 18, capacity: 25, category: "Vie de campus" },
    { id: "seed-campus-rabat-bouregreg", campus: "rabat-bouregreg", title: "Nettoyage des berges", description: "Collecte de déchets et plantation le long des berges, avec les associations locales.\n\nGants et sacs fournis.", days: 12, hourUtc: 16, capacity: 50, category: "Vie de campus" },
    { id: "seed-campus-marrakech-centre", campus: "marrakech-centre", title: "Forum des clubs de Marrakech", description: "Les clubs du campus présentent leurs bilans et leurs plans de l'année devant les étudiants.\n\nEntrée libre.", days: 12, hourUtc: 18, capacity: 80, category: "Vie de campus" },
    { id: "seed-campus-rabat-agdal-2", campus: "rabat-agdal-2", title: "Projection et débat", description: "Projection d'un court métrage marocain suivie d'un débat avec ses réalisateurs.\n\nSéance gratuite.", days: 13, hourUtc: 17, capacity: 55, category: "Vie de campus" },
    { id: "seed-campus-marrakech-gueliz", campus: "marrakech-gueliz", title: "Initiation à la photographie", description: "Sortie photo dans le quartier : cadrage, lumière et composition, débutants bienvenus.\n\nTéléphone ou appareil photo acceptable.", days: 14, hourUtc: 18, capacity: 30, category: "Vie de campus" },
    { id: "seed-campus-rabat-agdal-1", campus: "rabat-agdal-1", title: "Soirée jeux de société", description: "Jeux de société en français et en anglais, tables ouvertes toute la soirée.\n\nSnack offert.", days: 15, hourUtc: 17, capacity: 45, category: "Vie de campus" },
    { id: "seed-campus-agadir", campus: "agadir", title: "Lancement de l'année du BDE", description: "Retour sur l'an dernier et présentation du programme de l'année au campus d'Agadir.\n\nTous les étudiants sont invités.", days: 16, hourUtc: 18, capacity: 100, category: "Vie de campus" },
  ];

  for (const e of CAMPUS_EVENTS) {
    await upsertEvent({
      id: e.id,
      title: e.title,
      description: e.description,
      startsAt: daysFromNow(e.days, e.hourUtc),
      endsAt: daysFromNow(e.days, e.hourUtc + 2),
      location: amphitheatreOf(e.campus),
      capacity: e.capacity,
      status: "PUBLISHED",
      clubId: bdeOf(e.campus),
      categoryId: categories[e.category],
    });
  }

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
    { id: "seed-past-cleanup", title: "Clean campus : collecte & plantation", description: "Collecte de déchets et plantation sur la pelouse centrale.", days: 56, hourUtc: 9, hours: 3, location: "Campus Roudani - extérieur", capacity: null, club: "BDE EMSI Roudani", category: "Vie de campus" },
    { id: "seed-past-alumni", title: "Soirée alumni - premiers pas dans l'industrie", description: "Trois alumni racontent leurs premiers mois en entreprise.", days: 51, hourUtc: 18, minute: 30, hours: 2, location: "Amphi EMSI Roudani", capacity: 80, club: "Jeunes Leaders Marocains", category: "Vie de campus" },
    { id: "seed-past-hult", title: "Hult Prize - tour de préparation", description: "Brief, pitchs relais et coaching devant le jury interne.", days: 47, hourUtc: 16, hours: 3, location: "Espace Innovation - EMSI Roudani", capacity: 50, club: "Hult Prize EMSI", category: "Génie Industriel" },
    { id: "seed-past-soldering", title: "Atelier soudure : premiers cordons", description: "Réglage du fer, étain, sécurité : vos premiers cordons de soudure.", days: 44, hourUtc: 15, hours: 2, location: "Smartilab EMSI - Hall B", capacity: 25, club: "Club Innovation EMSI", category: "Génie Electrique et Systèmes Intelligents" },
    { id: "seed-past-lecture", title: "Cercle de lecture - rencontre mensuelle", description: "Discussion ouverte autour du roman du mois, café et croissants.", days: 40, hourUtc: 17, minute: 30, hours: 2, location: "Médiathèque - EMSI Maarif", capacity: 20, club: "Club de Lecture", category: "Vie de campus" },
    { id: "seed-past-android", title: "Atelier Android Studio : première app", description: "De zéro à une application installée sur votre téléphone.", days: 37, hourUtc: 18, hours: 3, location: "Salle info B2 - EMSI Roudani", capacity: 45, club: "Google Developer Student Clubs", category: "Ingénierie Informatique et Réseaux" },
    { id: "seed-past-futsal", title: "Tournoi de futsal inter-écoles", description: "Phase de groupes et finales sur le terrain couvert.", days: 33, hourUtc: 15, hours: 4, location: "Complexe sportif - Casablanca", capacity: 60, club: "Club Sportif EMSI", category: "Vie de campus" },
    { id: "seed-past-pitch", title: "Pitch club : cinq équipes, un jury", description: "Le mensuel Enactus : cinq minutes par équipe, questions du jury.", days: 30, hourUtc: 19, hours: 3, location: "Amphi EMSI Roudani", capacity: 70, club: "Enactus EMSI", category: "Génie Financier" },
    { id: "seed-past-erc-prep", title: "ERC : calibration des robots", description: "Dernière session avant éliminatoires : capteurs, moteurs, parcours.", days: 26, hourUtc: 14, hours: 4, location: "Piste Smartilab - EMSI Roudani", capacity: 30, club: "Club Innovation EMSI", category: "Ingénierie Automatisme et Informatique Industrielle" },
    { id: "seed-past-cineclub", title: "Ciné-club : classiques du cinéma marocain", description: "Séance commentée suivie d'un échange avec un étudiant en histoire.", days: 21, hourUtc: 20, hours: 3, location: "Amphi EMSI Roudani", capacity: null, club: "BDE EMSI Roudani", category: "Vie de campus" },
    { id: "seed-past-finance", title: "Atelier modélisation financière", description: "Construire un modèle de cash-flow propre en Excel, pas à pas.", days: 14, hourUtc: 11, hours: 2, location: "Salle C1 - EMSI Maarif", capacity: 35, club: "Enactus EMSI", category: "Génie Financier" },
    { id: "seed-past-debate", title: "Débat : télétravail en stage, pour ou contre ?", description: "Débat structuré, deux camps, vote du public à la fin.", days: 7, hourUtc: 18, hours: 2, location: "Salle des conférences - EMSI Maarif", capacity: 45, club: "Jeunes Leaders Marocains", category: "Ingénierie Informatique et Réseaux" },
    // The rest of the kingdom attended too: one history row per out-of-town
    // campus, so the insights heatmap is not Casablanca-only. Appended at
    // the END on purpose: the attendance loop derives its no-show pattern
    // from the row index, and renumbering would reshuffle seeded history.
    { id: "seed-past-tanger", title: "Portes ouvertes des ateliers de Tanger", description: "Les salles techniques ouvrent leurs portes, avec démonstrations des étudiants.", days: 42, hourUtc: 10, hours: 3, location: "Amphi EMSI Tanger", capacity: 60, club: "BDE EMSI Tanger", category: "Vie de campus" },
    { id: "seed-past-fes", title: "Rencontre professionnelle de Fès", description: "Des employeurs de la région présentent leurs métiers et leurs offres de stage.", days: 39, hourUtc: 15, hours: 3, location: "Amphi EMSI Fès", capacity: 70, club: "BDE EMSI Fès", category: "Vie de campus" },
    { id: "seed-past-rabat-hassan", title: "Orientation post-diplôme", description: "Après l'EMSI : masters, concours et création d'entreprise, avec des anciens du campus.", days: 35, hourUtc: 16, hours: 2, location: "Amphi EMSI Rabat Hassan", capacity: 80, club: "BDE EMSI Rabat Hassan", category: "Vie de campus" },
    { id: "seed-past-rabat-souissi", title: "Assemblée générale du BDE", description: "Bilan de l'année, vote des nouveaux bureaux et présentation du budget.", days: 24, hourUtc: 17, hours: 2, location: "Amphi EMSI Rabat Souissi", capacity: 120, club: "BDE EMSI Rabat Souissi", category: "Vie de campus" },
    { id: "seed-past-marrakech", title: "Sortie culturelle à Marrakech", description: "Visite guidée et déjeuner collectif pour les étudiants du campus.", days: 18, hourUtc: 9, hours: 5, location: "Amphi EMSI Marrakech Centre", capacity: 45, club: "BDE EMSI Marrakech Centre", category: "Vie de campus" },
    { id: "seed-past-agadir", title: "Marché de printemps du campus", description: "Stands étudiants, cuisine maison et musique sur la pelouse du campus.", days: 12, hourUtc: 14, hours: 4, location: "Amphi EMSI Agadir", capacity: 90, club: "BDE EMSI Agadir", category: "Vie de campus" },
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
