/**
 * A server action called with no network rejects with a TypeError
 * ("Failed to fetch" in Chrome, "Load failed" in Safari, "fetch failed" in
 * Node) — or simply because the browser already knows it is offline. That
 * is a connectivity STATE, not a crash: call sites map it to honest copy in
 * their own alert slot instead of letting it bubble into error.tsx, where
 * offline login used to render the app's "Something broke" screen.
 */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return (
    err instanceof TypeError &&
    /fetch|network|load failed/i.test(err.message)
  );
}
