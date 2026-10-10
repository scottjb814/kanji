import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";

function fixture() {
  const { document } = parseHTML("<html><body></body></html>");
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "text") n.textContent = value;
      else if (key === "class") n.className = value;
      else n.setAttribute(key, value);
    }
    for (const kid of kids) if (kid != null) n.append(kid);
    return n;
  };
  class DOMParser {
    parseFromString(text) { return parseHTML("<html><body>" + text + "</body></html>").document; }
  }
  const ctx = { URL, DOMParser, Date, console };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../historical-forms.js", import.meta.url), "utf8"), ctx);
  vm.runInContext(readFileSync(new URL("../image-provenance.js", import.meta.url), "utf8"), ctx);
  return { document, el, ...ctx, forms: ctx.KanjiHistoricalForms, provenance: ctx.KanjiImageProvenance };
}
const page = (title, license = "CC BY-SA 4.0") => ({ title, imageinfo: [{
  url: "https://upload.wikimedia.org/example.svg", descriptionurl: "https://commons.wikimedia.org/wiki/" + title,
  timestamp: "2024-01-01T00:00:00Z", extmetadata: {
    Artist: { value: '<b>Digital artist</b><script>bad()</script>' }, LicenseShortName: { value: license },
    LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
    Source: { value: "Uploader source statement" }, ImageDescription: { value: "A modern tracing of a seal form" }
  }
}] });
const tick = () => new Promise(resolve => setImmediate(resolve));

test("identifies Commons and local Japanese files without merging same-name files across hosts", () => {
  const f = fixture();
  const img = src => f.el("img", { src });
  const common = img("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/A.svg/120px-A.svg");
  const local = img("https://upload.wikimedia.org/wiktionary/ja/a/ab/A.svg");
  assert.equal(f.forms.imageIdentity(common, "ja"), "File:A.svg");
  assert.equal(f.forms.imageIdentity(local, "ja"), "WikiFile:ja.wiktionary.org:File:A.svg");
  assert.equal(f.forms.fileReference(local, "ja").host, "ja.wiktionary.org");
});

test("external and malformed images do not acquire invented Commons records", () => {
  const f = fixture();
  const external = f.el("img", { src: "https://glyphwiki.org/glyph/example.svg" });
  assert.equal(f.forms.fileReference(external, "ja"), null);
  assert.match(f.forms.imageIdentity(external, "ja"), /^URL:/);
  assert.equal(f.provenance.fileUrl({ host: "evil.example", title: "File:A.svg" }), null);
});

test("merging retains source page, revision and retrieval time", () => {
  const f = fixture();
  const record = { edition: "ja", sections: ["字源"], sectionIds: ["字源"], page: "惡", revision: 123,
    checkedAt: "2026-10-10T00:00:00Z", images: [{ identity: "File:A.svg", img: f.el("img"), context: "Seal script" }] };
  const source = f.forms.merge([[record]]).images[0].sources[0];
  assert.equal(source.page, "惡"); assert.equal(source.revision, 123);
  assert.equal(f.provenance.sourceUrl(source, "悪", true), "https://ja.wiktionary.org/w/index.php?oldid=123#%E5%AD%97%E6%BA%90");
});

test("resolver batches by host, follows normalization and redirects, and caches identical requests", async () => {
  const f = fixture(); const calls = [];
  const resolve = f.provenance.createResolver(async (host, params) => {
    calls.push({ host, params });
    return { query: { normalized: [{ from: "File:A_file.svg", to: "File:A file.svg" }],
      redirects: [{ from: "File:A file.svg", to: "File:Canonical.svg" }], pages: [page("File:Canonical.svg"), page("File:B.svg")] } };
  });
  const file = { host: "commons.wikimedia.org", title: "File:A_file.svg" };
  const a = resolve(file); assert.equal(a, resolve(file));
  const b = resolve({ ...file, title: "File:B.svg" });
  const [info] = await Promise.all([a, b]);
  assert.equal(calls.length, 1); assert.match(calls[0].params.titles, /\|/);
  assert.equal(info.title, "File:Canonical.svg"); assert.equal(info.creator, "Digital artist");
  await resolve(file); assert.equal(calls.length, 1);
});

test("failed metadata is retryable and missing file information is not a license", async () => {
  const f = fixture(); let calls = 0;
  const resolve = f.provenance.createResolver(async () => { if (++calls === 1) throw new Error("offline"); return { query: { pages: [{ title: "File:A.svg", missing: true }] } }; });
  const file = { host: "ja.wiktionary.org", title: "File:A.svg" };
  await assert.rejects(resolve(file), /offline/);
  assert.equal(await resolve(file), null); assert.equal(calls, 2);
});

test("unsafe metadata links and HTML are never forwarded as executable content", () => {
  const f = fixture(); const p = page("File:A.svg");
  p.imageinfo[0].extmetadata.LicenseUrl.value = "javascript:bad()";
  p.imageinfo[0].url = "http://insecure.example/a.svg";
  const info = f.provenance.metadata(p, "now");
  assert.equal(info.licenseUrl, null); assert.equal(info.original, null);
  assert.equal(info.creator, "Digital artist");
});

test("image details show source limitations and copy attribution with current dark-mode modification", async () => {
  const f = fixture(); let copied, dark = false;
  const item = { identity: "File:A.svg", file: { host: "commons.wikimedia.org", title: "File:A.svg" },
    context: "Shuowen Jiezi (compiled in Han) · Small seal script", sources: [{ edition: "en", page: "牛", revision: 321, checkedAt: "2026-10-10", anchor: "Glyph_origin" }] };
  const [status, panel] = f.provenance.details(item, "牛", { el: f.el,
    resolve: async () => f.provenance.metadata(page("File:A.svg"), "2026-10-10"), isDark: () => dark,
    clipboard: { writeText: async text => { copied = text; } } });
  f.document.body.append(status, panel); await tick();
  assert.match(status.textContent, /Credits available/);
  assert.match(panel.textContent, /not artifact date/);
  assert.match(panel.textContent, /Image type: not independently verified/);
  assert.ok(panel.querySelector('a[href*="oldid=321"]'));
  dark = true;
  panel.querySelector("button").click(); await tick();
  assert.match(copied, /Colors inverted for dark mode/);
  assert.match(copied, /Uploader's source statement/);
  assert.match(copied, /Wiktionary revision/);
});

test("unresolved external image remains visible with source and explicit attribution gap", async () => {
  const f = fixture();
  const item = { identity: "URL:https://glyphwiki.org/glyph/example.svg", context: "", sources: [{ edition: "ja", page: "牛" }] };
  const [status, panel] = f.provenance.details(item, "牛", { el: f.el, resolve: async () => null, isDark: () => false });
  await tick(); assert.equal(status.textContent, "Reuse information not verified");
  assert.ok(panel.querySelector('a[href="https://glyphwiki.org/glyph/example.svg"]'));
  assert.match(panel.textContent, /Revision not recorded/); assert.match(panel.textContent, /Unclassified/);
});

test("failed credit request shows a retry that replaces the unavailable status", async () => {
  const f = fixture(); let count = 0;
  const item = { identity: "File:A.svg", file: { host: "commons.wikimedia.org", title: "File:A.svg" }, sources: [] };
  const [status, panel] = f.provenance.details(item, "牛", { el: f.el, isDark: () => false,
    resolve: async () => { if (++count === 1) throw new Error("offline"); return f.provenance.metadata(page("File:A.svg"), "now"); } });
  await tick(); assert.match(status.textContent, /Credits unavailable/);
  [...panel.querySelectorAll("button")].find(n => n.textContent === "Retry credits").click();
  await tick(); assert.match(status.textContent, /Credits available/);
});

test("real thumb.wikimedia Japanese URLs deduplicate by file despite tracking parameters", () => {
  const f = fixture();
  const root = html => parseHTML('<html><body><div>' + html + '</div></body></html>').document.querySelector("div");
  const table = src => '<table class="zh-glyph"><tr><th>Bronze inscriptions</th></tr><tr><td><img src="' + src + '"></td></tr></table>';
  const en = f.forms.collect(root(table("https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/牛-bronze-shang.svg/120px-牛-bronze-shang.svg.png")), "en");
  const ja = f.forms.collect(root(table("https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/%E7%89%9B-bronze-shang.svg/120px-%E7%89%9B-bronze-shang.svg.png?utm_source=ja.wiktionary.org")), "ja");
  const merged = f.forms.merge([en, ja]);
  assert.equal(merged.images.length, 1);
  assert.equal(merged.images[0].file.host, "commons.wikimedia.org");
  assert.deepEqual(Array.from(merged.images[0].sources, s => s.edition), ["en", "ja"]);
});


test("catalogue labels support supplementary Han and reject ambiguous file names", () => {
  const f = fixture();
  assert.equal(f.forms.fileCharacter({title:"File:學-oracle.svg"}),"學");
  assert.equal(f.forms.fileCharacter({title:"File:𦥯-seal.svg"}),"𦥯");
  assert.equal(f.forms.fileCharacter({title:"File:學習.svg"}),null);
  assert.equal(f.forms.fileCharacter({title:"File:unidentified.svg"}),null);
});


test("shared file retains citations to both modern and traditional pages in one edition", () => {
  const f=fixture();
  const record=page=>({edition:"ja",page,sections:["字源"],sectionIds:["字源"],images:[{identity:"File:學-seal.svg",img:f.el("img"),context:"Small seal script"}]});
  const result=f.forms.merge([[record("学")],[record("學")]]);
  assert.equal(result.images.length,1);
  assert.deepEqual(Array.from(result.images[0].sources,x=>x.page),["学","學"]);
});
