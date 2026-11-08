/**
 * Pure geo helpers for the location-aware events (Phase 8). No Next.js or
 * DB imports: the same module serves server components and the browser
 * bundle, so distance math is written once.
 */

export type GeoPos = { lat: number; lng: number };

/**
 * Every EMSI campus in the kingdom (emsi.ma, 19 sites across Casablanca,
 * Rabat, Marrakech, Tanger, Fès and Agadir). Coordinates come from the
 * campus finder's own data attributes, except Agadir where emsi.ma ships a
 * copy-paste bug (it repeats Fès's coordinates) and the sensible city
 * centre stands in. They are centre-level, never claimed survey-accurate.
 *
 * The two original demo ids (`roudani`, `maarif`) are frozen: localStorage
 * and the probes pin them. Order groups cities together so the campus
 * select can render one optgroup per city.
 */
export const CAMPUSES: ReadonlyArray<{ id: string; name: string; city: string } & GeoPos> = [
  // Casablanca (7)
  { id: "roudani", name: "EMSI Roudani", city: "Casablanca", lat: 33.5815206, lng: -7.6338858 },
  { id: "maarif", name: "EMSI Maarif", city: "Casablanca", lat: 33.583699, lng: -7.642437 },
  { id: "casa-anfa", name: "EMSI Casa Anfa", city: "Casablanca", lat: 33.566244, lng: -7.666277 },
  { id: "moulay-youssef", name: "EMSI Moulay Youssef", city: "Casablanca", lat: 33.59266, lng: -7.627407 },
  { id: "centre-1", name: "EMSI Centre 1", city: "Casablanca", lat: 33.589107, lng: -7.605197 },
  { id: "centre-2", name: "EMSI Centre 2", city: "Casablanca", lat: 33.588782, lng: -7.605037 },
  { id: "les-orangers", name: "EMSI Les Orangers", city: "Casablanca", lat: 33.541582, lng: -7.673602 },
  // Rabat (7)
  { id: "rabat-centre-2", name: "EMSI Rabat Centre 2", city: "Rabat", lat: 34.017179, lng: -6.828717 },
  { id: "rabat-hassan", name: "EMSI Rabat Hassan", city: "Rabat", lat: 34.017494, lng: -6.832536 },
  { id: "rabat-souissi", name: "EMSI Rabat Souissi", city: "Rabat", lat: 33.968187, lng: -6.837679 },
  { id: "rabat-centre-1", name: "EMSI Rabat Centre 1", city: "Rabat", lat: 34.012412, lng: -6.82851 },
  { id: "rabat-bouregreg", name: "EMSI Rabat Bouregreg", city: "Rabat", lat: 34.024173, lng: -6.826896 },
  { id: "rabat-agdal-2", name: "EMSI Rabat Agdal 2", city: "Rabat", lat: 34.006158, lng: -6.845768 },
  { id: "rabat-agdal-1", name: "EMSI Rabat Agdal 1", city: "Rabat", lat: 33.999755, lng: -6.844679 },
  // Marrakech (2)
  { id: "marrakech-centre", name: "EMSI Marrakech Centre", city: "Marrakech", lat: 31.653787, lng: -8.021462 },
  { id: "marrakech-gueliz", name: "EMSI Marrakech Guéliz", city: "Marrakech", lat: 31.631419, lng: -8.012795 },
  // Single-site cities
  { id: "tanger", name: "EMSI Tanger", city: "Tanger", lat: 35.77112, lng: -5.805124 },
  { id: "fes", name: "EMSI Fès", city: "Fès", lat: 34.034183, lng: -5.008639 },
  { id: "agadir", name: "EMSI Agadir", city: "Agadir", lat: 30.43, lng: -9.6 },
];

/** Great-circle distance in km (haversine). */
export function distanceKm(a: GeoPos, b: GeoPos): number {
  const R = 6371; // Earth mean radius
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** The campus a set of coordinates belongs to: every seeded venue sits
 *  within a few km of exactly one campus centre, so "nearest" is honest
 *  grouping, not a political boundary. */
export function nearestCampus(pos: GeoPos): (typeof CAMPUSES)[number] {
  return CAMPUSES.reduce((best, c) =>
    distanceKm(pos, c) < distanceKm(pos, best) ? c : best
  );
}

/** One decimal below 10 km, whole kilometres after; the decimal separator
 *  follows the viewer's locale (Intl), never a hard-coded comma. */
export function formatKm(km: number, locale: string): string {
  const n = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)} km`;
}
