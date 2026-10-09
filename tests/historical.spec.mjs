import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const source = readFileSync(new URL("../historical-forms.js", import.meta.url), "utf8");
const ctx = { URL };
vm.createContext(ctx);
vm.runInContext(source, ctx);
const { collect, merge, imageIdentity } = ctx.KanjiHistoricalForms;
const root = html => parseHTML('<html><body><div class="mw-parser-output">' + html + "</div></body></html>")
  .document.querySelector(".mw-parser-output");
const file = name => '<a href="/wiki/File:' + name + '"><img src="//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/' + name + '/120px-' + name + '"></a>';
const glyph = (name = "Bronze.svg") => '<table class="wikitable zh-glyph"><tr><th>Historical forms of the character</th></tr>' +
  '<tr><th>Bronze inscriptions</th></tr><tr><td>' + file(name) + "</td></tr></table>";

test("detects historical forms in Chinese Glyph origin", () => {
  const r = collect(root(
    '<div class="mw-heading mw-heading2"><h2>Translingual</h2></div>' +
    "<p>Modern information</p>" +
    '<div class="mw-heading mw-heading2"><h2>Chinese</h2></div>' +
    '<div class="mw-heading mw-heading3"><h3>Glyph origin</h3></div>' + glyph()
  ), "en");
  assert.equal(r.length, 1);
  assert.deepEqual([...r[0].sections], ["Chinese", "Glyph origin"]);
  assert.equal(r[0].images[0].identity, "File:Bronze.svg");
});

test("finds tables under Translingual without a Glyph origin heading", () => {
  const r = collect(root('<h2>Translingual</h2><h3>Han character</h3>' + glyph()), "en");
  assert.equal(r.length, 1);
  assert.deepEqual([...r[0].sections], ["Translingual", "Han character"]);
});

test("accepts Japanese 字源 jigen tables and Chinese ancient-form captions", () => {
  const ja = collect(root('<h2>日本語</h2><h3>字源</h3><div id="jigen"><table><tr><td>' + file("Seal.svg") + "</td></tr></table></div>"), "ja");
  const zh = collect(root('<h2>漢語</h2><h3>字形</h3><table><tr><th>字形演變</th></tr><tr><td>' + file("Gold.svg") + "</td></tr></table>"), "zh");
  assert.equal(ja.length, 1);
  assert.equal(zh.length, 1);
  assert.equal(ja[0].images[0].identity, "File:Seal.svg");
});

test("ignores stroke-order graphics even if in an origin-related section", () => {
  const r = collect(root('<h2>Chinese</h2><h3>Glyph origin</h3><h4>Stroke order</h4>' + glyph()), "en");
  assert.equal(r.length, 0);
});

test("does not mistake general image tables for historical attestation", () => {
  const r = collect(root('<h2>Japanese</h2><h3>Writing</h3><table><tr><th>Current font</th></tr><tr><td>' +
     file("Printed.svg") + "</td></tr></table>"), "en");
  assert.equal(r.length, 0);
});

test("a section with two tables preserves distinct inscriptions", () => {
  const r = collect(root('<h2>Chinese</h2><h3>Glyph origin</h3>' + glyph("A.svg") + glyph("B.svg")), "en");
  assert.equal(r.length, 2);
  assert.equal(merge([r]).images.length, 2);
});

test("same Commons file with different thumbnails deduplicates, retaining both sources", () => {
  const en = collect(root("<h2>Chinese</h2>" + glyph("A.svg")), "en");
  const zh = collect(root("<h2>漢語</h2>" + glyph("A.svg")), "zh");
  const merged = merge([en, zh]);
  assert.equal(merged.images.length, 1);
  assert.deepEqual(Array.from(merged.images[0].sources, s => s.edition), ["en", "zh"]);
  assert.equal(merged.records.length, 2);
});

test("unrelated files under the same script heading are not combined", () => {
  const en = collect(root("<h2>Chinese</h2>" + glyph("Bronze1.svg")), "en");
  const zh = collect(root("<h2>漢語</h2>" + glyph("Bronze2.svg")), "zh");
  assert.equal(merge([en, zh]).images.length, 2);
});

test("recognizes Commons thumbnail and original as same identity without a file link", () => {
  const d = root('<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Some_Glyph.svg/240px-Some_Glyph.svg">' +
    '<img src="https://upload.wikimedia.org/wikipedia/commons/a/ab/Some_Glyph.svg">');
  const ims = d.querySelectorAll("img");
  assert.equal(imageIdentity(ims[0]), "File:Some Glyph.svg");
  assert.equal(imageIdentity(ims[1]), "File:Some Glyph.svg");
});

test("handles empty tables and invalid image URLs gracefully", () => {
  const d = root('<h2>Chinese</h2><table class="zh-glyph"><tr><td></td></tr></table>' +
    '<table class="zh-glyph"><tr><td><img src="javascript:alert(1)"></td></tr></table>');
  assert.equal(collect(d, "en").length, 0);
});

test("different images in the same table inherit their own column labels", () => {
  const table = '<table class="zh-glyph">' +
    '<tr><th colspan="2">Historical forms</th></tr>' +
    '<tr><th>Oracle bone script</th><th>Bronze inscriptions</th></tr>' +
    '<tr><td>' + file("Oracle.svg") + '</td><td>' + file("Bronze.svg") + '</td></tr></table>';
  const forms = collect(root('<h2>Chinese</h2><h3>Glyph origin</h3>' + table), "en");
  assert.equal(forms.length, 1);
  const merged = merge([forms]);
  assert.deepEqual(Array.from(merged.images, item => item.group), ["Oracle bone", "Bronze"]);
  assert.match(merged.images[0].context, /Oracle bone/);
  assert.match(merged.images[1].context, /Bronze/);
});

test("an unlabeled image does not inherit a different column's historical era", () => {
  const table = '<table class="zh-glyph">' +
    '<tr><th colspan="2">Historical forms</th></tr>' +
    '<tr><th>Oracle bone script</th><th>Unknown</th></tr>' +
    '<tr><td>' + file("Oracle.svg") + '</td><td>' + file("Unknown.svg") + '</td></tr></table>';
  const forms = collect(root('<h2>Chinese</h2><h3>Glyph origin</h3>' + table), "en");
  assert.deepEqual(Array.from(merge([forms]).images, item => item.group), ["Oracle bone", "Other forms"]);
});
