import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { LOCALE_DIRS } from "@/i18n/core";
import { getLocale, getT } from "@/i18n/server";
import { formatDate, formatEventRange, isSameCampusDay } from "@/lib/tz";
import { renderPoster } from "@/lib/poster";

/**
 * The shareable poster: a handbill-sized SVG of a published event, in the
 * viewer's locale, built to leave the site intact — the buttons on the detail
 * page hand this file to the Web Share API or open it for print.
 *
 * Public like /calendar: only PUBLISHED events get a poster (a draft or a
 * cancelled event is not something to hand a stranger), and everything on it
 * is data that page already shows publicly.
 *
 * Fonts are embedded as base64 woff2 so the shared FILE keeps its typeface on
 * another device — a poster that silently falls back to Helvetica on the
 * receiving phone is a different poster. Memoised per process: the files
 * never change between requests.
 */

const FONT_FILES = [
  { family: "Cabinet Grotesk", weight: 400, file: "cabinet-grotesk-400.woff2" },
  { family: "Cabinet Grotesk", weight: 500, file: "cabinet-grotesk-500.woff2" },
  { family: "Cabinet Grotesk", weight: 800, file: "cabinet-grotesk-800.woff2" },
  // The site's Arabic face, arabic subset (Latin proper nouns fall through
  // to Cabinet, exactly like the live stack). No 800 exists — Plex tops out
  // at 700, which CSS matching serves to an 800 request.
  { family: "IBM Plex Sans Arabic", weight: 400, file: "ibm-plex-arabic-400.woff2" },
  { family: "IBM Plex Sans Arabic", weight: 500, file: "ibm-plex-arabic-500.woff2" },
  { family: "IBM Plex Sans Arabic", weight: 700, file: "ibm-plex-arabic-700.woff2" },
] as const;

function faceCss(family: string, weight: number, src: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(${src}) format('woff2')}`;
}

let fontCssPromise: Promise<string> | null = null;
function fontCss(): Promise<string> {
  fontCssPromise ??= (async () => {
    try {
      const faces = await Promise.all(
        FONT_FILES.map(async ({ family, weight, file }) =>
          faceCss(
            family,
            weight,
            `data:font/woff2;base64,${(await readFile(join(process.cwd(), "public", "fonts", file))).toString("base64")}`
          )
        )
      );
      return faces.join("");
    } catch {
      // Deploy without public/ on disk: the URL copies still load for a
      // same-origin render (browser tab, print), and only the travelled
      // file degrades to the system stack — same behaviour, one layer down.
      return FONT_FILES.map(({ family, weight, file }) =>
        faceCss(family, weight, `/fonts/${file}`)
      ).join("");
    }
  })();
  return fontCssPromise;
}

/** ASCII-safe download name; an Arabic title collapses to the fallback. */
function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "poster";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [event, locale, t, css] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: {
        club: true,
        category: true,
        _count: { select: { rsvps: { where: { status: "CONFIRMED" } } } },
      },
    }),
    getLocale(),
    getT(),
    fontCss(),
  ]);
  if (!event || event.status !== "PUBLISHED") {
    return new Response("Not found", { status: 404 });
  }

  // Same labels the detail header prints — one page, one poster, one truth.
  const dateLabel = isSameCampusDay(event.startsAt, event.endsAt)
    ? `${formatDate(event.startsAt, locale)} · ${formatEventRange(event.startsAt, event.endsAt, locale)}`
    : formatEventRange(event.startsAt, event.endsAt, locale);

  const taken = event._count.rsvps;
  const factsLine =
    event.capacity === null
      ? t("detail.openToAll")
      : `${t("detail.rsvp.spotsTaken", { n: taken, total: event.capacity })} · ${
          event.capacity - taken > 0
            ? t(event.capacity - taken === 1 ? "detail.spotsLeftOne" : "common.spotsLeft", {
                n: event.capacity - taken,
              })
            : t("events.full")
        }`;

  const svg = renderPoster({
    title: event.title,
    clubName: event.club.name,
    categoryName: event.category.name,
    dateLabel,
    location: event.location,
    factsLine,
    url: `${new URL(req.url).origin}/events/${event.id}`,
    dir: LOCALE_DIRS[locale],
    fontCss: css,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Inline so a browser renders it on click; the filename still lands
      // right when someone chooses "save link as".
      "Content-Disposition": `inline; filename="campus-pulse-${slugify(event.title)}.svg"`,
      // Same stance as /calendar: the rail prints live counts, so a cached
      // poster would print yesterday's numbers.
      "Cache-Control": "no-store",
    },
  });
}
