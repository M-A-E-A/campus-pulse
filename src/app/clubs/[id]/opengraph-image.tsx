import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import {
  INK,
  PAPER,
  ACCENT,
  loadOgFonts,
  Beat,
  Wordmark,
  fit,
  GenericCard,
} from "@/lib/og";

/**
 * The club profile's link preview — the poster profile in miniature: the
 * monogram stamp beside the name, the wordmark up top, the first sentence
 * of the description riding the orange rail. Shares the whole pipeline
 * (palette, fonts, mark, fallback) with the event poster via src/lib/og.tsx.
 *
 * Same public rule as the event card: any club id that doesn't exist falls
 * back to the generic card, so a typo'd URL never previews a name. And no
 * live numbers — followers printed here would be stale by the time a
 * scraper shows them.
 *
 * FR is the club data language (names and descriptions are written in it),
 * so the card's words match the profile beside it.
 */

export const alt = "Profil du club — Campus Pulse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Names are short but one-liners shout hardest; novels still have to fit
 *  next to the monogram (≈820px of column left of it). */
function clubTitleFontSize(len: number): number {
  if (len <= 16) return 84;
  if (len <= 30) return 70;
  if (len <= 48) return 58;
  if (len <= 70) return 48;
  return 40;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [club, fonts] = await Promise.all([
    prisma.club.findUnique({ where: { id } }),
    loadOgFonts(),
  ]);

  return new ImageResponse(club ? <ClubCard club={club} /> : <GenericCard />, {
    width: size.width,
    height: size.height,
    fonts,
  });
}

function ClubCard({ club }: { club: { name: string; description: string } }) {
  // First sentence only — a preview answers "who is this", not the whole
  // paragraph (same split the generic card uses on the meta description).
  const [lead] = club.description.split(". ");
  const name = fit(club.name, 44);
  const monogram = club.name.charAt(0).toUpperCase();

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
          CLUB
        </div>
      </div>

      {/* Monogram stamp + name — the profile header's composition. */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          padding: "0 64px",
          gap: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 168,
            height: 168,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ACCENT,
            color: INK,
            fontSize: 96,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {monogram}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 820,
            minWidth: 0,
          }}
        >
          <div
            style={{
              color: PAPER,
              fontSize: clubTitleFontSize(club.name.length),
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -1.5,
            }}
          >
            {name}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: ACCENT,
          padding: "30px 64px",
          gap: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            color: INK,
            opacity: 0.78,
            fontSize: 30,
            fontWeight: 500,
            minWidth: 0,
          }}
        >
          {fit(lead, 110)}
        </div>
        <Beat size={60} color={INK} />
      </div>
    </div>
  );
}
