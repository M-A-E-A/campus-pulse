import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fr } from "@/i18n/dict/common";

/**
 * The shared link-preview pipeline: the palette, satori's font loader, the
 * pulse mark, the wordmark, the size-fitting helpers and the generic
 * fallback card. Extracted from the event OG route when the club profiles
 * arrived (Phase 12) so every route that ships a preview renders from the
 * same bytes — one palette, one font loader memoised per process, one mark.
 *
 * Pure presentation: no Prisma, no Next — each route fetches its own rows
 * and composes its own card from these parts. satori renders the styles
 * inline (no CSS classes reach it), hence the inline style objects.
 *
 * The fonts are .ttf twins of the woff2 the site loads: satori parses fonts
 * with opentype.js, which rejects woff2 outright ("Unsupported OpenType
 * signature wOF2"). Browsers get woff2, the renderer gets TTF — same bytes,
 * one uncompressed.
 */

export const INK = "#14130f";
export const PAPER = "#faf7f2";
export const ACCENT = "#ff4d00";

/** The file convention reads `size` from the route; routes re-export this. */
export const OG_SIZE = { width: 1200, height: 630 };

const FONT_FILES = [
  { weight: 400, file: "cabinet-grotesk-400.ttf" },
  { weight: 500, file: "cabinet-grotesk-500.ttf" },
  { weight: 800, file: "cabinet-grotesk-800.ttf" },
] as const;

/** Memoised per process: the woff2 files never change between requests. */
type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
let fontsPromise: Promise<
  { name: string; data: Buffer; weight: Weight; style: "normal" }[]
> | null = null;
export function loadOgFonts() {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ weight, file }) => ({
      name: "Cabinet Grotesk",
      weight,
      style: "normal" as const,
      data: await readFile(join(process.cwd(), "src", "fonts", file)),
    }))
  );
  return fontsPromise;
}

/** The pulse mark, one ECG beat — same path as the nav, footer and handbill. */
export function Beat({ size: px, color }: { size: number; color: string }) {
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none">
      <path
        d="M1 13.5h4.5L8 6l4 13 3-9 1.8 3.5H23"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="square"
      />
    </svg>
  );
}

/** satori has no ellipsis: hard-slice before the layout would ever overflow. */
export function fit(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Display sizes by title length so a one-liner shouts and a novel still fits. */
export function titleFontSize(len: number): number {
  if (len <= 28) return 96;
  if (len <= 48) return 84;
  if (len <= 80) return 72;
  if (len <= 120) return 60;
  return 50;
}

export function Wordmark() {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
      <Beat size={44} color={ACCENT} />
      <span
        style={{
          color: PAPER,
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 5,
          marginLeft: 18,
        }}
      >
        CAMPUS PULSE · EMSI
      </span>
    </div>
  );
}

/** Generic card: real dictionary copy, no event, nothing to leak. */
export function GenericCard() {
  // First two sentences of the FR meta description — one source of truth.
  const [lead, ...rest] = fr["meta.description"].split(". ");
  const trailer = rest.join(". ");
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
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2,
          }}
        >
          {lead}
        </div>
        <div
          style={{
            color: PAPER,
            opacity: 0.7,
            fontSize: 32,
            fontWeight: 500,
            marginTop: 28,
          }}
        >
          {trailer}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: ACCENT,
          padding: "34px 64px",
        }}
      >
        <Beat size={54} color={INK} />
      </div>
    </div>
  );
}
