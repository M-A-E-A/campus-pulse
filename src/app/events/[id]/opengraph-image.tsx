import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { formatDate, formatEventRange, isSameCampusDay } from "@/lib/tz";
import {
  INK,
  PAPER,
  ACCENT,
  loadOgFonts,
  Beat,
  Wordmark,
  fit,
  titleFontSize,
  GenericCard,
} from "@/lib/og";

/**
 * The link-preview card: a 1200×630 typographic poster that leaves the site
 * every time the URL is pasted into WhatsApp, X, Slack or a message. No
 * photos — the poster wall's own idiom, rendered by satori from the same
 * Cabinet Grotesk files the site ships (read from disk, never fetched).
 *
 * The pipeline (palette, font loader, mark, fallback card) lives in
 * src/lib/og.tsx and is shared with the club profiles (Phase 12) — this
 * file owns only the event composition and its data.
 *
 * The file convention owns og:image: Next injects the meta tag with the
 * right absolute URL, width, height and type, so generateMetadata only has
 * to describe the card's words.
 *
 * Public by construction: only a PUBLISHED event gets its title on the card,
 * ever — anything else falls back to the generic card. Deliberately no live
 * numbers (spots taken, distance): scrapers cache these images for days, so
 * any count printed here would be lying by Tuesday.
 */

export const alt = "Affiche de l'événement — Campus Pulse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, fonts] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: { club: true, category: true },
    }),
    loadOgFonts(),
  ]);

  const view =
    !event || event.status !== "PUBLISHED" ? null : event;

  return new ImageResponse(view ? <EventCard event={view} /> : <GenericCard />, {
    width: size.width,
    height: size.height,
    fonts,
  });
}

function EventCard({
  event,
}: {
  event: {
    title: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    club: { name: string };
    category: { name: string };
  };
}) {
  // Same labels the detail header prints — one event, one truth. FR is the
  // event data language, so the card matches the title beside it.
  const dateLabel = isSameCampusDay(event.startsAt, event.endsAt)
    ? `${formatDate(event.startsAt, "fr")} · ${formatEventRange(event.startsAt, event.endsAt, "fr")}`
    : formatEventRange(event.startsAt, event.endsAt, "fr");

  const title = fit(event.title, 150);
  const club = fit(event.club.name, 60);
  const where = fit(event.location, 70);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: INK,
        fontFamily: "Cabinet Grotesk",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 64px 0 64px",
        }}
      >
        <Wordmark />
        <div
          style={{
            display: "flex",
            backgroundColor: ACCENT,
            color: INK,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 3,
            padding: "10px 22px",
            whiteSpace: "nowrap",
          }}
        >
          {fit(event.category.name.toUpperCase(), 26)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          padding: "0 64px",
        }}
      >
        <div
          style={{
            color: PAPER,
            fontSize: titleFontSize(event.title.length),
            fontWeight: 800,
            lineHeight: 1.07,
            letterSpacing: -1.5,
          }}
        >
          {title}
        </div>
        <div style={{ color: PAPER, opacity: 0.75, fontSize: 34, fontWeight: 500, marginTop: 30 }}>
          {club}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: ACCENT,
          padding: "28px 64px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: INK, fontSize: 38, fontWeight: 800 }}>{dateLabel}</div>
          <div style={{ color: INK, opacity: 0.72, fontSize: 27, fontWeight: 500, marginTop: 8 }}>
            {where}
          </div>
        </div>
        <Beat size={64} color={INK} />
      </div>
    </div>
  );
}
