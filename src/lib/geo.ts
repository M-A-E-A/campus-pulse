/**
 * Pure geo helpers for the location-aware events (Phase 8). No Next.js or
 * DB imports — the same module serves server components and the browser
 * bundle, so distance math is written once.
 */

export type GeoPos = { lat: number; lng: number };

/**
 * The campuses the demo data actually uses, both in Casablanca. Coordinates
 * are district-level approximations (good enough to rank a 5-card wall),
 * never claimed as survey-accurate.
 */
export const CAMPUSES: ReadonlyArray<{ id: string; name: string } & GeoPos> = [
  { id: "roudani", name: "EMSI Roudani", lat: 33.5731, lng: -7.5898 },
  { id: "maarif", name: "EMSI Maarif", lat: 33.5719, lng: -7.6133 },
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

/** The campus a set of coordinates belongs to — every seeded venue sits
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
