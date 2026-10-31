import type { Vars } from "./core";
import * as common from "./dict/common";
import * as nav from "./dict/nav";
import * as landing from "./dict/landing";
import * as events from "./dict/events";
import * as detail from "./dict/detail";
import * as dashboard from "./dict/dashboard";
import * as organizer from "./dict/organizer";
import * as admin from "./dict/admin";
import * as auth from "./dict/auth";
import * as errors from "./dict/errors";
import * as pulse from "./dict/pulse";
import * as qr from "./dict/qr";
import * as calendar from "./dict/calendar";
import * as insights from "./dict/insights";
import * as notifications from "./dict/notifications";
import * as tickets from "./dict/tickets";
import * as clubs from "./dict/clubs";
import * as scan from "./dict/scan";

/**
 * One flat dictionary per language, merged from namespaces.
 * Each namespace file checks its own completeness:
 *   `fr: Record<keyof typeof en, string>` — a missing or stray key is a tsc error.
 * Keys are namespace-prefixed (nav.*, landing.*, events.*, …) to avoid collisions.
 */
export const en = {
  ...common.en,
  ...nav.en,
  ...landing.en,
  ...events.en,
  ...detail.en,
  ...dashboard.en,
  ...organizer.en,
  ...admin.en,
  ...auth.en,
  ...errors.en,
  ...pulse.en,
  ...qr.en,
  ...calendar.en,
  ...insights.en,
  ...notifications.en,
  ...tickets.en,
  ...clubs.en,
  ...scan.en,
};

export type DictKey = keyof typeof en;
export type FullDict = Record<DictKey, string>;

/** The translate function shape used by both server and client call sites. */
export type T = (key: DictKey, vars?: Vars) => string;

export const fr: FullDict = {
  ...common.fr,
  ...nav.fr,
  ...landing.fr,
  ...events.fr,
  ...detail.fr,
  ...dashboard.fr,
  ...organizer.fr,
  ...admin.fr,
  ...auth.fr,
  ...errors.fr,
  ...pulse.fr,
  ...qr.fr,
  ...calendar.fr,
  ...insights.fr,
  ...notifications.fr,
  ...tickets.fr,
  ...clubs.fr,
  ...scan.fr,
};

export const ar: FullDict = {
  ...common.ar,
  ...nav.ar,
  ...landing.ar,
  ...events.ar,
  ...detail.ar,
  ...dashboard.ar,
  ...organizer.ar,
  ...admin.ar,
  ...auth.ar,
  ...errors.ar,
  ...pulse.ar,
  ...qr.ar,
  ...calendar.ar,
  ...insights.ar,
  ...notifications.ar,
  ...tickets.ar,
  ...clubs.ar,
  ...scan.ar,
};
