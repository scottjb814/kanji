import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.split("<script>\n", 2)[1].split("</script>", 1)[0];
const begin = script.indexOf("  // ---------- Historical glyphs: one collection");
const end = script.indexOf("  // ---------- Rendering ----------", begin);
assert.ok(begin >= 0 && end > begin, "gallery renderer is present");
const source = script.slice(begin, end);

function fixture() {
  const { document } = parseHTML("<!doctype html><html><body><main></main></body></html>");
  const calls = { credits: 0 };
  const node = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (val == null) continue;
      if (key === "text") e.textContent = val;
      else if (key === "class") e.className = val;
      else e.setAttribute(key, String(val));
    }
    for (const child of children) if (child !== null && child !== undefined) e.append(child);
    return e;
  };
  const ctx = {
    document, URL, el: node,
    glyphImg: (img,alt) => node("img", { src: img.getAttribute("src"), alt }),
    wiktUrl: (char,lang) => "https://" + lang + ".wiktionary.org/wiki/" + encodeURIComponent(char),
    creditsFor: box => {
      calls.credits++;
      const n = box.querySelectorAll(".forms a.form[href*='/wiki/File:']").length;
      return n ? node("details", {class:"credits","data-files":String(n)}) : null;
    },
    lookupJa: () => Promise.resolve({ historical: [] }),
    lookupZh: () => Promise.resolve({ historical: [] }),
    window: { KanjiHistoricalForms: { merge: data => ({
      images: data.flatMap(group => group.flatMap(record => record.images || []))
    }) } }
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { document, node, ctx, calls };
}
function image(f, filename, group, context, sources) {
  return { identity:"File:" + filename, img:f.node("img",{src:"https://upload.wikimedia.org/" + filename}),
    group, context, sources };
}
const sourceInfo = (edition, sections) => ({edition,sections});

test("groups glyphs by script and leaves uncertain classifications in Other forms", () => {
  const f = fixture();
  const images = [
    image(f,"Seal.svg","Seal","Seal script", [sourceInfo("en",["Chinese","Glyph origin"])]),
    image(f,"Unknown.svg","Other forms","", [sourceInfo("ja",["漢字","字源"])]),
    image(f,"Bronze.svg","Bronze","Bronze inscriptions", [sourceInfo("zh",["漢語","字源"])]),
  ];
  const gallery=f.ctx.renderHistorical("字",{images});
  assert.deepEqual(Array.from(gallery.querySelectorAll("h4"),n=>n.textContent),["Bronze (1)","Seal (1)","Other forms (1)"]);
});

test("renders one Commons image link and two separate source edition links", () => {
  const f=fixture();
  const im=image(f,"Bronze character.svg","Bronze","Bronze inscriptions",[
    sourceInfo("en",["Chinese","Glyph origin"]),
    sourceInfo("ja",["漢字","字源"])
  ]);
  const gallery=f.ctx.renderHistorical("牛",{images:[im]});
  const commons=gallery.querySelector("a.form");
  assert.equal(commons.getAttribute("href"),"https://commons.wikimedia.org/wiki/File:Bronze_character.svg");
  assert.match(commons.getAttribute("aria-label"),/Historical glyph of 牛/);
  assert.equal(commons.querySelector("img").getAttribute("alt"),"Historical glyph of 牛, Bronze");
  const sources=Array.from(gallery.querySelectorAll(".hg-sources a"));
  assert.deepEqual(sources.map(n=>n.textContent),["EN","JA"]);
  assert.equal(sources[0].getAttribute("href"),"https://en.wiktionary.org/wiki/%E7%89%9B");
  assert.match(sources[1].getAttribute("title"),/漢字 › 字源/);
  assert.equal(gallery.querySelectorAll("a.form").length,1);
});

test("gallery shows a useful empty state and does not guess that images exist", () => {
  const f=fixture();
  const gallery=f.ctx.renderHistorical("討",{images:[]});
  assert.match(gallery.textContent,/No historical-form images/);
  assert.equal(gallery.querySelectorAll("img").length,0);
});

test("hydration merges sources before calculating Wikimedia credits",async () => {
  const f=fixture();
  const box=f.node("article");
  const slot=f.node("section"), credits=f.node("div");
  box.append(slot,credits);
  f.document.querySelector("main").append(box);
  const enImage=image(f,"Seal.svg","Seal","Seal script",[sourceInfo("en",["Chinese","Glyph origin"])]);
  f.ctx.window.KanjiHistoricalForms.merge = collections => {
    assert.equal(collections.length,3);
    return {images:[enImage]};
  };
  f.ctx.hydrateHistorical(box,"牛",{historical:[{images:[enImage]}]},slot,credits);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(slot.querySelectorAll(".hg-item").length,1);
  assert.equal(credits.querySelectorAll(".credits").length,1);
  assert.equal(credits.querySelector(".credits").getAttribute("data-files"),"1");
  assert.equal(f.calls.credits,1);
});

test("failed edition shows partial English results and a retry action",async () => {
  const f=fixture();
  const box=f.node("article"), slot=f.node("section"), credits=f.node("div");
  box.append(slot,credits);f.document.querySelector("main").append(box);
  const enImage=image(f,"Oracle.svg","Oracle bone","Oracle bone inscriptions",[sourceInfo("en",["Chinese","Glyph origin"])]);
  f.ctx.lookupJa=()=>Promise.reject(new Error("upstream down"));
  f.ctx.window.KanjiHistoricalForms.merge=histories=>({images:histories[0][0].images});
  f.ctx.hydrateHistorical(box,"牛",{historical:[{images:[enImage]}]},slot,credits);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(slot.querySelectorAll(".hg-item").length,1);
  assert.match(slot.textContent,/results may be incomplete/);
  assert.equal(slot.querySelectorAll("button").length,1);
});
