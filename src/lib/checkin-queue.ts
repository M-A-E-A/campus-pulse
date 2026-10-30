/**
 * Door-side offline queue for check-in scans.
 *
 * The venue Wi-Fi dies mid-door; a person is standing in front of you with
 * a QR code. Losing that scan is not an option, so a failed (offline) scan
 * is kept here — localStorage, per door device — and re-sent when the
 * network returns: on the page's `online` event, on the next time the
 * scanner opens, or via the manual Sync button.
 *
 * Why localStorage and not SW Background Sync: the queue must survive a
 * reload (it does), and the scanner drains it as soon as it has JS again.
 * Background Sync would only add drain-while-closed, which a door screen
 * that's open all night doesn't need — and the service worker stays
 * strictly ticket-cache (see public/sw.js).
 *
 * Safety property: the server is idempotent (performCheckIn only fires
 * while checkedInAt IS NULL, otherwise "duplicate"), so re-sending is
 * safe and a conflict — someone else checked the same person in during
 * the outage — surfaces as an honest `duplicate` row after sync, never
 * as a double count.
 *
 * Deduping is by (eventId, code): a QR held in front of a live camera for
 * ten seconds queues once, not ten times. Codes carry their eventId so a
 * scanner opened for another event never drains someone else's queue.
 */

export type PendingScan = {
  /** `${eventId}:${code}` — dedupe key and stable React key. */
  id: string;
  eventId: string;
  code: string;
  /** ISO timestamp of the scan at the door (not of the sync). */
  at: string;
};

const KEY = "cp-checkin-queue-v1";

/** SSR-safe: no window on the server, no queue to hydrate. */
export function loadQueue(): PendingScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is PendingScan =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as PendingScan).id === "string" &&
        typeof (e as PendingScan).eventId === "string" &&
        typeof (e as PendingScan).code === "string" &&
        typeof (e as PendingScan).at === "string"
    );
  } catch {
    // Corrupt JSON (or storage disabled) → behave as an empty queue.
    return [];
  }
}

function persist(queue: PendingScan[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(queue));
    return true;
  } catch {
    // Quota exceeded / private mode: the caller shows the honest alert.
    return false;
  }
}

/**
 * Queue one scan. Returns false when it couldn't be stored (quota) —
 * the caller must tell the organizer the scan was LOST, not pretend.
 * Re-scanning the same code refreshes its timestamp instead of piling up.
 */
export function enqueueScan(entry: { eventId: string; code: string }): boolean {
  const id = `${entry.eventId}:${entry.code}`;
  const queue = loadQueue().filter((s) => s.id !== id);
  queue.push({ id, eventId: entry.eventId, code: entry.code, at: new Date().toISOString() });
  return persist(queue);
}

/** Drop a scan once the server has answered it (any answer — including
 *  "duplicate" or "invalid": the honest result lands in the scan history). */
export function removeScan(id: string): void {
  if (typeof window === "undefined") return;
  persist(loadQueue().filter((s) => s.id !== id));
}

/** The scans this scanner (event) is responsible for, oldest first. */
export function queueForEvent(eventId: string): PendingScan[] {
  return loadQueue()
    .filter((s) => s.eventId === eventId)
    .sort((a, b) => a.at.localeCompare(b.at));
}
