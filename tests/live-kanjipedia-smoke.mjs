// Manual live smoke test only. Never store or print dictionary page text.
// Usage: node tests/live-kanjipedia-smoke.mjs
import { findExactEntry, entryHeadword, parseNaritachi } from "../worker/worker.js";

async function html(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "KanjiLookupPersonal/1.0 (personal testing; https://github.com/scottjb814/kanji)",
      "Accept-Language": "ja",
    },
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}

let errors = 0;
for (const ch of ["討", "学"]) {
  try {
    const search = await html("https://www.kanjipedia.jp/search?k=" + encodeURIComponent(ch) + "&kt=1&sk=leftHand");
    const entry = findExactEntry(search, ch);
    if (!entry) throw new Error("no exact link");
    const page = await html(entry);
    if (entryHeadword(page) !== ch) throw new Error("entry title mismatch");
    const explanation = parseNaritachi(page);
    if (!explanation) throw new Error("explanation not parsed");
    console.log(ch + ": PASS (exact match, verified entry title, explanation parsed; " + explanation.parts.length + " parts)");
  } catch (error) {
    errors++;
    console.log(ch + ": FAIL (" + error.message + ")");
  }
}
if (errors) process.exitCode = 1;
