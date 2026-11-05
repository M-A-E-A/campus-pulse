// Read-time helpers for the creator traffic dashboard. The collector stores
// the raw user-agent, and the console classifies it here — so the schema
// never has to change when a browser renames itself.

export type DeviceKind = "mobile" | "desktop";
export type BrowserKind = "chrome" | "safari" | "firefox" | "edge" | "other";

/**
 * Deliberately coarse: phone vs desktop is the question the console asks,
 * and the four families cover every UA string worth showing. Order matters
 * — Edge ships Chrome's token, Chrome ships Safari's.
 */
export function parseUa(ua: string | null | undefined): {
  device: DeviceKind;
  browser: BrowserKind;
} {
  if (!ua) return { device: "desktop", browser: "other" };
  const device: DeviceKind = /Android|iPhone|iPod|Windows Phone|Mobile/.test(ua)
    ? "mobile"
    : "desktop";
  const browser: BrowserKind = /Edg\//.test(ua)
    ? "edge"
    : /Firefox\/|FxiOS\//.test(ua)
      ? "firefox"
      : /Chrome\/|CriOS\//.test(ua)
        ? "chrome"
        : /Safari\//.test(ua)
          ? "safari"
          : "other";
  return { device, browser };
}

/**
 * How the console groups a visit's referrer: null/empty means the visitor
 * arrived directly, a leading slash means the site itself (SPA navigation
 * from the previous page), anything else is an external referrer whose
 * host is what gets shown.
 */
export function referrerKind(ref: string | null | undefined): "direct" | "internal" | "external" {
  if (!ref) return "direct";
  if (ref.startsWith("/")) return "internal";
  return "external";
}

/** Host of an external referrer URL; null when it does not parse. */
export function referrerHost(ref: string): string | null {
  try {
    return new URL(ref).host;
  } catch {
    return null;
  }
}
