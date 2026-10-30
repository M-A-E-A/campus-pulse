/**
 * Poster render probe: fetch the poster the way a browser will — as a
 * top-level SVG DOCUMENT — in French and Arabic, and prove it actually
 * renders: the SVG root exists, every text run has real width (a zero-width
 * text node means a wrapping/measure bug), Cabinet Grotesk really loaded
 * (not the fallback stack), and the RTL variant flips direction. Photographs
 * both into .taste-skill/ so the artifact itself can be judged, not just
 * its markup.
 *
 * Usage: node scripts/probe-poster.mjs   (prod server on :3100)
 */
import { Browser } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const origin = "http://localhost:3100";
const OUT = ".taste-skill";
const EVENT = "seed-event-line-follower";

const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const browser = await Browser.launch();
try {
  async function capturePoster(tag, localeCookie) {
    const page = await browser.newPage({ width: 1200, height: 1600, dsf: 1 });
    if (localeCookie) {
      await page.send("Network.setCookie", {
        name: "cp-locale",
        value: localeCookie,
        url: origin,
      });
    }
    await page.goto(`${origin}/api/events/${EVENT}/poster`, {
      timeoutMs: 30000,
      settleMs: 800,
    });
    const info = await page.eval(`(() => {
      const svg = document.querySelector("svg");
      if (!svg) return { ok: false };
      const texts = [...document.querySelectorAll("text")];
      return {
        ok: true,
        zeroWidth: texts.filter((t) => t.getComputedTextLength() <= 0).length,
        textCount: texts.length,
        title: document.querySelector("title") ? document.querySelector("title").textContent : "",
        dir: svg.getAttribute("direction") || "ltr",
        cabinet: document.fonts.check('800 100px "Cabinet Grotesk"'),
        plex: document.fonts.check('700 100px "IBM Plex Sans Arabic"'),
        fontsStatus: document.fonts.status,
        canvas: { w: svg.clientWidth, h: svg.clientHeight },
      };
    })()`);
    await page.screenshot({ path: `${OUT}/poster-${tag}.jpg`, quality: 88 });
    await page.close();
    return info;
  }

  const fr = await capturePoster("fr", null);
  check("French poster renders as an SVG document", fr.ok, `texts=${fr.textCount} canvas=${fr.canvas?.w}x${fr.canvas?.h}`);
  check("no empty text runs (wrap/measure holds)", fr.ok && fr.zeroWidth === 0, `zeroWidth=${fr.zeroWidth}/${fr.textCount}`);
  check("Cabinet Grotesk actually loads (not fallback)", fr.ok && fr.cabinet === true, `fonts=${fr.fontsStatus} cabinet=${fr.cabinet}`);
  check("poster title names the event", fr.ok && /line-follower/i.test(fr.title), JSON.stringify(fr.title));

  const ar = await capturePoster("ar", "ar");
  check("Arabic poster renders, RTL flipped", ar.ok && ar.dir === "rtl", `dir=${ar.dir} texts=${ar.textCount}`);
  check("Arabic text has real width", ar.ok && ar.zeroWidth === 0, `zeroWidth=${ar.zeroWidth}/${ar.textCount}`);
  check("IBM Plex Sans Arabic actually loads", ar.ok && ar.plex === true, `fonts=${ar.fontsStatus} plex=${ar.plex}`);

  // The print path is the same document — assert the intrinsic size a
  // browser would print at (vector, so this size is nominal, not a limit).
  const page = await browser.newPage({ width: 900, height: 700, dsf: 1 });
  await page.goto(`${origin}/api/events/${EVENT}/poster`, { timeoutMs: 30000, settleMs: 500 });
  const sizing = await page.eval(
    `({ w: document.documentElement.getAttribute("width"), h: document.documentElement.getAttribute("height") })`
  );
  await page.close();
  check("poster declares its print canvas", sizing.w === "1200" && sizing.h === "1600", `${sizing.w}x${sizing.h}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
