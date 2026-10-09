// Opt-in live Wiktionary integration probe. No upstream pages are stored.
// Usage after npm install: node tests/live-wiktionary-forms.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";
const js = readFileSync(new URL("../historical-forms.js", import.meta.url), "utf8");
const ctx = { URL };
vm.createContext(ctx);
vm.runInContext(js, ctx);
const { collect, merge } = ctx.KanjiHistoricalForms;

async function load(lang, character) {
  const params = new URLSearchParams({
    action: "parse", page: character, prop: "text", redirects: "1",
    disableeditsection: "1", format: "json", formatversion: "2", origin: "*",
  });
  const url = "https://" + lang + ".wiktionary.org/w/api.php?" + params;
  const r = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "KanjiGlyphLookup/1.0 (personal research; contact via github.com/scottjb814/kanji)" }
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const response = await r.json();
  if (response.error?.code === "missingtitle") return [];
  if (!response.parse?.text) throw new Error("missing parse HTML");
  const doc = parseHTML(response.parse.text).document;
  return collect(doc.querySelector(".mw-parser-output") || doc.body, lang);
}
let errors = 0;
for (const char of ["討", "牛", "字"]) {
  const byEdition = [];
  for (const lang of ["en", "ja", "zh"]) {
    try {
      const data = await load(lang, char);
      const count = data.reduce((n, r) => n + r.images.length, 0);
      const sections = data.slice(0, 2).map(x => x.sections.join(" > "));
      byEdition.push(data);
      console.log(char + "/" + lang + ": " + data.length + " tables, " + count + " glyph occurrences, sections=" + JSON.stringify(sections));
    } catch (e) {
      errors++;
      console.log(char + "/" + lang + ": ERROR " + String(e.message || e).slice(0, 120));
    }
  }
  const result = merge(byEdition);
  console.log(char + ": " + result.images.length + " distinct glyph files across " + result.records.length + " source tables");
  if (char === "牛" && !result.images.length) {
    errors++;
    console.log("牛: ERROR no historical glyphs discovered");
  }
}
if (errors) process.exitCode = 1;
