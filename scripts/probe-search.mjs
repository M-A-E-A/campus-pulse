/**
 * Search E2E (Phase 6): the events explorer must reach all four fields —
 * title, club, category (the old matcher silently missed it) and location —
 * and the Arabic-aware normalization must be the shipped module, not a
 * re-implementation: the first section imports src/lib/search.ts directly
 * (run via `node --import tsx`) and asserts its mappings, including the
 * Arabic side the seeded demo data cannot exercise (every stored title and
 * club is Latin). The second section proves the wiring in a real browser:
 * queries are typed into the actual filter, and a tashkeel-laced Latin
 * query must land on exactly the same cards as the plain one.
 *
 * Usage: node --import tsx scripts/probe-search.mjs   (prod server on :3100)
 */
import { Browser, sleep } from "../.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs";
import { normalizeSearch, searchMatches } from "../src/lib/search.ts";

const origin = "http://localhost:3100";
const results = [];
const check = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

// ---- 1. The shipped normalizer, asserted directly -------------------------
check(
  "folds case + whitespace",
  normalizeSearch("  Soudure\t") === "soudure",
  JSON.stringify(normalizeSearch("  Soudure\t"))
);
check(
  "strips tashkeel and tatweel",
  normalizeSearch("سَوْدُر\u0640ة") === "سودره",
  JSON.stringify(normalizeSearch("سَوْدُر\u0640ة"))
);
check(
  "alef variants fold to bare alef",
  normalizeSearch("إحصاءات آرمدة ٱلكتاب") === "احصاءات ارمده الكتاب",
  JSON.stringify(normalizeSearch("إحصاءات آرمدة ٱلكتاب"))
);
check(
  "maqsura meets yaa, ta marbuta meets ha",
  normalizeSearch("موسى ساعة") === normalizeSearch("موسي ساعه"),
  JSON.stringify(normalizeSearch("موسى ساعة"))
);
check(
  "bare types meet hamza carriers",
  normalizeSearch("مسؤولي") === "مسوولي",
  JSON.stringify(normalizeSearch("مسؤولي"))
);
check(
  "Arabic-Indic digits become Latin",
  normalizeSearch("قاعة ٢٠٢٦ / ۰۹") === "قاعه 2026 / 09",
  JSON.stringify(normalizeSearch("قاعة ٢٠٢٦ / ۰۹"))
);
check(
  "pasted direction marks disappear",
  normalizeSearch("روضة\u200F\u061C") === "روضه",
  JSON.stringify(normalizeSearch("روضة\u200F\u061C"))
);
check(
  "decoration-proof match both ways",
  searchMatches("ورشة الساعة", "السَّاعَة") && searchMatches("Atelier soudure", "sou\u064Fdure"),
  "Arabic query ↔ stored, tashkeel inside Latin"
);
check(
  "still refuses what is not there",
  searchMatches("Atelier soudure", "génie") === false,
  "no false positive"
);

// ---- 2. The real filter, in a real browser -------------------------------
const browser = await Browser.launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });
  await page.goto(`${origin}/events`, { timeoutMs: 30000, settleMs: 1600 });

  const countCards = () => page.eval(`document.querySelectorAll("[data-flip-id]").length`);
  const total = await countCards();
  check("events wall loads", total > 0, `cards=${total}`);

  /** Type into the React-controlled search box; wait out debounce + Flip.
   *  Pass a real FUNCTION: cdp.mjs only inlines `arg` on the function
   *  branch (`(${fn})(${arg})`) — a string is evaluated as a bare
   *  expression and the argument silently vanishes. */
  const search = async (q) => {
    await page.eval((query) => {
      const input = document.querySelector('input[type="search"]');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, query);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, q);
    await sleep(950); // 250ms debounce + 450ms Flip + margin
    return countCards();
  };

  // The wall only shows published AND upcoming events, so use a title that
  // is actually on it ("Pitch de minuit"), not the draft's "soudure".
  const minuit = await search("minuit");
  check("title field", minuit >= 1 && minuit < total, `"minuit" → ${minuit}/${total}`);

  const club = await search("innovation");
  check("club field", club >= 1 && club < total, `"innovation" → ${club}/${total}`);

  // "automatisme" appears ONLY in a category name ("Ingénierie Automatisme
  // et Informatique Industrielle") — the field the old matcher missed.
  const category = await search("automatisme");
  check("category field", category >= 1 && category < total, `"automatisme" → ${category}/${total}`);

  const location = await search("casablanca");
  check("location field", location >= 1 && location < total, `"casablanca" → ${location}/${total}`);

  const decorated = await search("mi\u064Fnuit"); // damma dropped inside the word
  check(
    "tashkeel on a Latin query lands on the same cards",
    decorated === minuit,
    `"mi\u064Fnuit" → ${decorated} (plain: ${minuit})`
  );

  const none = await search("zzq-no-such-event-999");
  const emptyShown = await page.eval(`!!document.querySelector(".empty")`);
  check("no matches → empty state", none === 0 && emptyShown, `cards=${none} empty=${emptyShown}`);

  const restored = await search("");
  check("clearing restores the wall", restored === total, `cards=${restored}`);

  await page.screenshot({ path: ".taste-skill/search-cover.jpg", quality: 88 });
  await page.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nTOTAL: ${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
