/**
 * Search normalization for the events explorer (Phase 6: title / club /
 * category / location, Arabic-aware). Applied to BOTH sides of every match,
 * so a query and the stored text meet in the middle:
 *
 * Arabic — written forms vary far more than what is stored: tashkeel and
 * tatweel are noise, alef has four spellings (ٱ أ إ آ), maqsura and yaa are
 * the same key to a searcher, ta marbuta is regularly typed as ha
 * (ساعة / ساعه), hamza-carrying و and ي get typed bare, RTL direction marks
 * ride along in pasted text, and Arabic-Indic digits (٢٠٢٦) differ from the
 * Latin ones people also type.
 *
 * Latin — case folds, whitespace collapses (pasted queries included).
 *
 * Pure and importable from both the client bundle and node: the search E2E
 * probe asserts these exact mappings against this shipped module, then
 * drives the real filter in a browser.
 */
export function normalizeSearch(text: string): string {
  return (
    text
      .toLowerCase()
      // harakat (fatha → sukun), superscript alef, tatweel
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      // alef variants → bare alef (آ أ إ ٱ → ا)
      .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
      // maqsura → yaa (ى → ي)
      .replace(/\u0649/g, "\u064A")
      // ta marbuta → ha (ة → ه): ساعة ≈ ساعه
      .replace(/\u0629/g, "\u0647")
      // hamza carriers → their base letters (ؤ → و، ئ → ي): مسؤول ≈ مسوول
      .replace(/[\u0624\u0626]/g, (c) => (c === "\u0624" ? "\u0648" : "\u064A"))
      // direction marks and bidi controls from pasted text (LRM/RLM/ALM/…)
      .replace(/[\u200E-\u200F\u061C\u202A-\u202E]/g, "")
      // Arabic-Indic + Extended Arabic-Indic digits → Latin (٢٠٢٦ → 2026)
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Does this (normalized) query appear anywhere in the stored fields? */
export function searchMatches(fields: string, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(fields).includes(q);
}
