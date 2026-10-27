/**
 * Render the PWA icon set from the Campus Pulse mark (one ECG stroke).
 *
 * Why screenshots instead of an image library: the mark is a stroked SVG and
 * the project has no raster tooling — Chromium is already a dependency of the
 * inspection scripts, so it renders the exact vector at exact pixel sizes and
 * writes PNGs. No new packages, and the icons can never drift from Logo.tsx
 * (the path lives in one constant below).
 *
 * Two scales:
 *   68% — regular tiles (fills the square, standard optical density)
 *   64% — the maskable tile, kept inside the 80%-diameter safe circle Android
 *         masks to, so the mark is never clipped by a round or squircle shape.
 *
 * Usage: CHROME_PATH=<chrome> node scripts/gen-pwa-icons.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Browser } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

/** Keep in sync with src/components/Logo.tsx (PulseMark). */
const MARK_PATH = "M1 13.5h4.5L8 6l4 13 3-9 1.8 3.5H23";
const INK = "#14130f";
const ACCENT = "#ff4d00";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });
mkdirSync("src/app", { recursive: true });

const TARGETS = [
  { file: join(OUT, "icon-192.png"), size: 192, scale: 68 },
  { file: join(OUT, "icon-512.png"), size: 512, scale: 68 },
  { file: join(OUT, "icon-maskable-512.png"), size: 512, scale: 64 },
  { file: "src/app/icon.png", size: 48, scale: 68 }, // tab favicon (file convention)
  { file: "src/app/apple-icon.png", size: 180, scale: 68 }, // iOS home screen
];

function pageHtml(size, scalePct) {
  const px = Math.round((size * scalePct) / 100);
  return `<!doctype html><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0 }
  html, body {
    width: ${size}px; height: ${size}px; overflow: hidden; background: ${INK};
    display: flex; align-items: center; justify-content: center;
  }
</style>
<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="${MARK_PATH}" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="square"/>
</svg>`;
}

const browser = await Browser.launch();
try {
  for (const t of TARGETS) {
    const page = await browser.newPage({ width: t.size, height: t.size, dsf: 1 });
    const htmlPath = join(tmpdir(), `cp-icon-${t.size}-${t.scale}.html`);
    writeFileSync(htmlPath, pageHtml(t.size, t.scale));
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { timeoutMs: 15000, settleMs: 250 });
    await page.screenshot({
      path: t.file,
      format: "png",
      clip: { x: 0, y: 0, width: t.size, height: t.size },
    });
    console.log(`wrote ${t.file} (${t.size}x${t.size}, mark at ${t.scale}%)`);
    await page.close();
  }
} finally {
  await browser.close();
}
