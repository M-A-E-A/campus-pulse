/**
 * The shareable event poster: a handbill-sized SVG of the design tokens the
 * site wears (ink / paper / signal orange, Cabinet Grotesk + IBM Plex Sans
 * Arabic), so the redesign's poster-wall metaphor leaves the building.
 *
 * Pure string-building, zero Next.js or Prisma imports — the route only
 * feeds it data, and it can be reasoned about without a server.
 *
 * Why SVG (not PNG): it is resolution-independent, so one artifact is both
 * the phone-share image and the print-sized export — a browser prints it at
 * any DPI with no second pipeline. It must therefore be SELF-CONTAINED:
 * the fonts are embedded as data URIs by the route, because a poster shared
 * as a file to another device must not silently change typeface.
 *
 * Layout, top to bottom — the detail page's header frozen into one frame:
 *   ink field · title (800, auto-fitted) · category chip + club credits
 *   (stacked when a row can't hold both) · the pulse beat running full-bleed
 *   into the orange facts rail (date / venue / capacity) with the event URL
 *   as a scannable QR card on the rail's far side · footer rule, mark,
 *   wordmark, event URL — the whole composition mirrored for RTL.
 * No photo: the wall this poster joins is typographic, and an external
 * <image> would break the moment the file travels off-site.
 *
 * The QR is VECTOR (one merged <path> of module runs, generated from the
 * same URL the footer prints): resolution-independent like the rest of the
 * file, ~1 kB of path data, and it survives being scaled to A3 or shown on
 * a phone — the poster → /scan loop's other half. Its POSITION mirrors for
 * RTL; the pattern itself never does — a mirrored QR is a QR nobody scans.
 *
 * SVG's text-anchor FLIPS under direction="rtl": "start" pins the RIGHT
 * edge of a run there, the LEFT edge here. Every alignment in this file
 * therefore goes through textAttrs() — the one place that knows.
 */

import { create as createQr } from "qrcode";

export type PosterInput = {
  title: string;
  clubName: string;
  categoryName: string;
  /** Pre-formatted campus-time labels (the route owns tz + locale). */
  dateLabel: string;
  location: string;
  /** Capacity line, already translated ("12 of 60 spots taken · 48 left"). */
  factsLine: string;
  /** Absolute URL of the event, printed in the footer. */
  url: string;
  dir: "ltr" | "rtl";
  /** The @font-face block: embedded woff2 data URIs, or URL fallback. */
  fontCss: string;
};

const W = 1200;
const H = 1600;
const PAD = 84;
const FOOTER_H = 140;

// The drawn palette, verbatim from globals.css — one source of poster colour.
const INK = "#14130f";
const PAPER = "#faf7f2";
const ACCENT = "#ff4d00";

// The scannable corner: a white card on the rail's far side carrying the
// event URL as vector modules. The card size is fixed (it's composition);
// the module grid inside adapts to the URL's QR version.
const QR_CARD = 208;
const QR_QUIET = 24; // ≥4 modules of quiet zone at every URL length

const FONT_STACK = "Cabinet Grotesk, 'Helvetica Neue', Helvetica, Arial, sans-serif";
// Site parity: Arabic swaps the whole stack; Plex's arabic subset carries no
// Latin, so proper nouns ("EMSI") fall through to Cabinet — same as the app.
const ARABIC_STACK =
  "'IBM Plex Sans Arabic', 'Cabinet Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// Cabinet Grotesk ships 400/500/800 only; Plex tops out at 700, which CSS
// font-matching serves to an 800 request. Advance estimates run ~10% over
// the measured Latin widths (~0.44–0.50) so lines end short, never spill.
const ADVANCE: Record<number, number> = { 400: 0.52, 500: 0.55, 800: 0.57 };

const ARABIC_RE = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/;
const runDir = (line: string): "rtl" | "ltr" => (ARABIC_RE.test(line) ? "rtl" : "ltr");

function textWidth(text: string, size: number, weight: number): number {
  return text.length * size * (ADVANCE[weight] ?? 0.58);
}

/** Truncate with an ellipsis so a run never exceeds its box. */
function fitToWidth(text: string, maxWidth: number, size: number, weight: number): string {
  if (textWidth(text, size, weight) <= maxWidth) return text;
  let cut = Math.max(1, Math.floor((text.length * maxWidth) / textWidth(text, size, weight)));
  while (cut < text.length && textWidth(`${text.slice(0, cut)}…`, size, weight) > maxWidth) {
    cut--;
  }
  return `${text.slice(0, cut).trimEnd()}…`;
}

/** Greedy word wrap on an estimated advance. SVG has no native wrapping and
 *  measuring would need a browser, so the estimate runs deliberately generous
 *  — lines end short rather than spilling past the poster edge. */
function wrap(
  text: string,
  size: number,
  weight: number,
  maxWidth: number,
  maxLines: number
): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let rest = word;
    // A single word wider than a whole line gets hard-broken with a hyphen
    // instead of silently running off the canvas.
    while (textWidth(rest, size, weight) > maxWidth && rest.length > 1) {
      let cut = Math.max(1, Math.floor((rest.length * maxWidth) / textWidth(rest, size, weight)));
      while (cut < rest.length - 1 && textWidth(`${rest.slice(0, cut + 1)}-`, size, weight) > maxWidth) {
        cut--;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      out.push(`${rest.slice(0, cut)}-`);
      rest = rest.slice(cut);
    }
    const merged = line ? `${line} ${rest}` : rest;
    if (line && textWidth(merged, size, weight) > maxWidth) {
      out.push(line);
      line = rest;
    } else {
      line = merged;
    }
  }
  if (line) out.push(line);
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return kept;
  }
  return out;
}

/** XML text/attribute escaping — the title is user input. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Position + anchor + direction for one text run, honouring the anchor flip:
 *   right-aligned: rtl pins the run's right edge ("start"), ltr its right
 *   edge ("end"); left-aligned is the mirror. "middle" is direction-free.
 * Each run also carries its OWN direction, so a Latin line on an Arabic
 * poster ("Club Innovation EMSI", "2026") anchors and bidi-resolves as LTR
 * instead of spilling off the margin its neighbours hug.
 */
function textAttrs(line: string, x: number, align: "left" | "right" | "center"): string {
  const dir = runDir(line);
  const anchor =
    align === "center" ? "middle" : (dir === "rtl") === (align === "right") ? "start" : "end";
  const family = dir === "rtl" ? ` font-family="${ARABIC_STACK}"` : "";
  return `x="${x}" text-anchor="${anchor}" direction="${dir}"${family}`;
}

/**
 * The event URL as ONE merged <path> of module runs, centered in a card at
 * (x, y): dark runs drawn horizontally so a version-4 matrix (33×33) costs
 * a few hundred path segments, not a thousand <rect>s. Returns null when
 * the URL can't be encoded — a poster must still print without its QR.
 */
function qrModulesPath(url: string, x: number, y: number): string | null {
  try {
    const qr = createQr(url, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const inner = QR_CARD - QR_QUIET * 2;
    const mod = Math.floor(inner / size);
    const drawn = mod * size;
    const ox = x + QR_QUIET + Math.floor((inner - drawn) / 2);
    const oy = y + QR_QUIET + Math.floor((inner - drawn) / 2);
    let d = "";
    for (let row = 0; row < size; row++) {
      let run = 0;
      for (let col = 0; col <= size; col++) {
        const dark = col < size && Boolean(data[row * size + col]);
        if (dark) run += 1;
        else if (run > 0) {
          d += `M${ox + (col - run) * mod} ${oy + row * mod}h${run * mod}v${mod}h${-run * mod}z`;
          run = 0;
        }
      }
    }
    return d ? `<path d="${d}" fill="${INK}"/>` : null;
  } catch {
    return null;
  }
}

export function renderPoster(input: PosterInput): string {
  const rtl = input.dir === "rtl";
  const xRight = W - PAD;
  const xLeft = PAD;
  const maxWidth = W - PAD * 2;
  const align = rtl
    ? ({ main: "right", far: "left" } as const)
    : ({ main: "left", far: "right" } as const);

  // Facts rail first: its height decides how much room the title may claim.
  // The QR card is a FIXED block on the rail's far side, so the facts text
  // wraps in whatever width the card leaves — the card never moves, the
  // lines yield (and their count feeds railH exactly as before).
  const qrX = rtl ? xLeft : W - PAD - QR_CARD;
  const railTextMax = maxWidth - QR_CARD - 40;
  const dateLines = wrap(input.dateLabel, 52, 800, railTextMax, 2);
  const locLines = wrap(input.location, 34, 500, railTextMax, 2);
  const factsLines = wrap(input.factsLine, 30, 500, railTextMax, 1);
  const railH = 44 + dateLines.length * 55 + 20 + locLines.length * 36 + 16 + 32 + 44;
  const railTop = H - FOOTER_H - railH;
  // The rail's floor (one line of everything) is 247px > QR_CARD, so the
  // centered card always lands inside the orange band.
  const qrY = railTop + Math.floor((railH - QR_CARD) / 2);

  // Credits: orange category chip + club, the same row the detail page
  // prints under its headline (below the title — never as a kicker above
  // it). Long strings truncate; a chip that would crowd the club off the
  // canvas drops the club to its own row instead.
  const chipSize = 30;
  const chipPadX = 20;
  const chipPadY = 16;
  const chipH = chipSize + chipPadY * 2;
  const category = fitToWidth(input.categoryName, maxWidth - chipPadX * 2, chipSize, 800);
  const chipW = Math.ceil(textWidth(category, chipSize, 800)) + chipPadX * 2;
  const stacked = chipW + 24 + textWidth(input.clubName, 34, 500) > maxWidth;
  const club = stacked
    ? input.clubName
    : fitToWidth(input.clubName, maxWidth - chipW - 24, 34, 500);
  const creditsH = stacked ? chipH + 14 + 34 : chipH;

  // Fit the title: start big, shrink until the whole stack clears the beat,
  // the rail and the footer with at least 48px of air to spare. A poster's
  // title is the one thing that must never clip.
  let titleSize = 120;
  let titleLines = wrap(input.title, titleSize, 800, maxWidth, 6);
  for (const size of [120, 112, 104, 96, 88, 80, 72, 64, 56]) {
    titleSize = size;
    titleLines = wrap(input.title, size, 800, maxWidth, 6);
    const titleH = titleLines.length * size * 1.05;
    const topH = PAD + titleH + 52 + creditsH; // pad + title + gap + credits
    if (topH + 60 + railH + FOOTER_H <= H - 48 || size === 56) break;
  }
  const creditsTop = PAD + titleLines.length * titleSize * 1.05 + 52;

  const parts: string[] = [];

  // Title — baselines computed manually: dominant-baseline support varies.
  {
    let y = PAD + titleSize * 0.8;
    for (const line of titleLines) {
      parts.push(
        `<text ${textAttrs(line, rtl ? xRight : xLeft, align.main)} y="${y}" font-size="${titleSize}" font-weight="800" fill="${PAPER}">${esc(line)}</text>`
      );
      y += titleSize * 1.05;
    }
  }

  // Credits.
  {
    const chipX = rtl ? W - PAD - chipW : PAD;
    parts.push(
      `<rect x="${chipX}" y="${creditsTop}" width="${chipW}" height="${chipH}" fill="${ACCENT}"/>`,
      `<text ${textAttrs(category, chipX + chipW / 2, "center")} y="${creditsTop + chipPadY + chipSize * 0.8}" font-size="${chipSize}" font-weight="800" fill="${INK}">${esc(category)}</text>`
    );
    const clubY = stacked ? creditsTop + chipH + 14 + 34 * 0.8 : creditsTop + chipH / 2 + 12;
    const clubX = stacked
      ? rtl
        ? xRight
        : xLeft
      : rtl
        ? chipX - 24
        : chipX + chipW + 24;
    parts.push(
      `<text ${textAttrs(club, clubX, stacked ? align.main : align.far)} y="${clubY}" font-size="34" font-weight="500" fill="${PAPER}" opacity="0.75">${esc(club)}</text>`
    );
  }

  // The pulse beat — the Logo mark's ECG re-plotted at poster scale, square
  // caps, scaled to fill the air between the credits and the rail, its dip
  // plunging into the orange band: the pulse becoming the poster. Mirrored
  // for RTL so the spike leads from the reading side.
  {
    const beatH = Math.max(60, Math.min(300, railTop - creditsTop - creditsH - 48));
    const k = Math.round((beatH / 120) * 1000) / 1000;
    const ky = (y: number) => Math.round(y * k * 10) / 10;
    const beat = `M0 ${ky(67.7)}H275L400 ${ky(10)}L600 ${beatH}L750 ${ky(42.3)}L840 ${ky(67.7)}H1200`;
    const mirror = rtl ? ` translate(${W},0) scale(-1,1)` : "";
    parts.push(
      `<g transform="translate(0,${railTop - beatH})${mirror}"><path d="${beat}" stroke="${ACCENT}" stroke-width="14" fill="none" stroke-linecap="square"/></g>`
    );
  }

  // The orange facts rail — date, venue, capacity, at full-bleed width.
  parts.push(`<rect x="0" y="${railTop}" width="${W}" height="${railH}" fill="${ACCENT}"/>`);
  {
    const tx = rtl ? xRight : xLeft;
    let y = railTop + 44 + 52 * 0.8;
    for (const line of dateLines) {
      parts.push(
        `<text ${textAttrs(line, tx, align.main)} y="${y}" font-size="52" font-weight="800" fill="${INK}">${esc(line)}</text>`
      );
      y += 55;
    }
    y += 20 - 55 + 34 * 0.8;
    for (const line of locLines) {
      parts.push(
        `<text ${textAttrs(line, tx, align.main)} y="${y}" font-size="34" font-weight="500" fill="${INK}">${esc(line)}</text>`
      );
      y += 36;
    }
    y += 16 - 36 + 30 * 0.8;
    for (const line of factsLines) {
      parts.push(
        `<text ${textAttrs(line, tx, align.main)} y="${y}" font-size="30" font-weight="500" fill="${INK}" opacity="0.72">${esc(line)}</text>`
      );
      y += 32;
    }
  }

  // The QR card: white on orange, modules in ink, vertically centered on
  // the rail's far side. Its POSITION mirrors for RTL — the pattern never
  // does (see the file header).
  {
    const qrPath = qrModulesPath(input.url, qrX, qrY);
    if (qrPath) {
      parts.push(
        `<rect x="${qrX}" y="${qrY}" width="${QR_CARD}" height="${QR_CARD}" fill="#ffffff"/>`,
        qrPath
      );
    }
  }

  // Footer: hard paper rule, the mark, the wordmark, the URL to act on —
  // mark and wordmark on the reading side, URL on the far margin.
  const footerTop = H - FOOTER_H;
  {
    const markX = rtl ? W - PAD - 56 : PAD;
    const wordX = rtl ? markX - 20 : markX + 56 + 20;
    const urlLabel = input.url.length > 54 ? `${input.url.slice(0, 53)}…` : input.url;
    parts.push(
      `<rect x="0" y="${footerTop}" width="${W}" height="2" fill="${PAPER}" opacity="0.9"/>`,
      `<g transform="translate(${markX},${footerTop + 42}) scale(2.33)"><path d="M1 13.5h4.5L8 6l4 13 3-9 1.8 3.5H23" stroke="${ACCENT}" stroke-width="2.6" fill="none" stroke-linecap="square"/></g>`,
      `<text ${textAttrs("CAMPUS PULSE", wordX, align.main)} y="${footerTop + 80}" font-size="30" font-weight="800" fill="${PAPER}" letter-spacing="5">CAMPUS PULSE</text>`,
      `<text ${textAttrs(urlLabel, rtl ? xLeft : xRight, align.far)} y="${footerTop + 80}" font-size="22" font-weight="400" fill="${PAPER}" opacity="0.55">${esc(urlLabel)}</text>`
    );
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT_STACK}" text-rendering="geometricPrecision"${rtl ? ` direction="rtl"` : ""}>`,
    `<title>Campus Pulse — ${esc(input.title)}</title>`,
    `<style>${input.fontCss}</style>`,
    `<rect width="${W}" height="${H}" fill="${INK}"/>`,
    ...parts,
    `</svg>`,
  ].join("\n");
}
