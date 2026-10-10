// Opt-in real Chromium smoke test with synthetic Wiktionary API responses.
// Run with Playwright installed: node tests/visual-smoke.mjs
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const server = spawn("python3", ["-m", "http.server", "8765", "--bind", "127.0.0.1"], { stdio: "ignore" });
const origin = "http://127.0.0.1:8765";
const part = (name) => '<a href="/wiki/File:' + name + '"><img alt="牛" src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/' + name + '/140px-' + name + '"></a>';
function table(name, label) {
  return '<table class="zh-glyph"><tr><th>Historical forms</th></tr><tr><th>' + label +
    '</th></tr><tr><td>' + part(name) + '</td></tr></table>';
}
function headings(lang, heading, contents) {
  return '<div class="mw-parser-output"><div class="mw-heading mw-heading2"><h2 id="' + lang + '">' + lang +
    '</h2></div><div class="mw-heading mw-heading3"><h3 id="' + heading.replaceAll(" ", "_") + '">' + heading +
    '</h3></div>' + contents + '</div>';
}
const data = {
  "en.wiktionary.org": headings("Chinese", "Glyph origin",
    table("Shared.svg", "Bronze inscriptions") + table("English.svg", "Seal script") +
    "<p>English source explanation.</p>"),
  "ja.wiktionary.org": headings("漢字", "字源",
    table("Shared.svg", "Bronze inscriptions") + table("Japanese.svg", "Oracle bone") +
    "<p>Japanese source explanation.</p>"),
  "zh.wiktionary.org": headings("漢語", "字源",
    table("Chinese.svg", "Seal script") + "<p>Chinese source explanation.</p>"),
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 850 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on("pageerror", e => consoleErrors.push(e.message));
  await page.route("**/w/api.php?**", async route => {
    const host = new URL(route.request().url()).hostname;
    const html = data[host] || "";
    await route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(new URL(route.request().url()).searchParams.get("action") === "query"
        ? { query: { pages: ["Shared.svg", "English.svg", "Japanese.svg", "Chinese.svg"].map(name => ({ title: "File:" + name, imageinfo: [{ url: "https://upload.wikimedia.org/" + name, descriptionurl: "https://commons.wikimedia.org/wiki/File:" + name, timestamp: "2026-01-01T00:00:00Z", extmetadata: { LicenseShortName: {value: "Public domain"}, Artist: {value: "Synthetic creator"} } }] })) } }
        : { parse: { title: "牛", revid: 12345, text: html } })
    });
  });
  await page.route("**/data/kanjidic.json", async route => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ chars: { "牛": { o: ["ギュウ"], m: ["cow"] } } })
    });
  });
  await page.route("https://upload.wikimedia.org/**", async route => {
    await route.fulfill({
      status: 200, contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#f8f8f8"/><text x="48" y="69" font-size="67" text-anchor="middle">牛</text></svg>'
    });
  });
  await page.goto(origin + "/?q=" + encodeURIComponent("牛"), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll(".historical .hg-item").length === 4, { timeout: 15000 });
  const counts = await page.evaluate(() => ({
    glyphs: document.querySelectorAll(".historical .hg-item").length,
    groups: Array.from(document.querySelectorAll(".historical-group h4"), h => h.textContent),
    sharedLinks: Array.from(document.querySelectorAll(".historical .hg-item"), x => ({
      href: x.querySelector(".form")?.getAttribute("href"),
      editions: Array.from(x.querySelectorAll(".hg-sources a"), a => a.textContent)
    })),
    credits: document.querySelectorAll(".historical-credits .credits").length,
    originalTables: document.querySelectorAll(".block details").length,
    prose: document.querySelector(".block .prose")?.textContent
  }));
  assert.equal(counts.glyphs, 4, "deduplicate the shared image");
  assert.equal(counts.credits, 1, "credits must be populated after async gallery");
  assert.ok(counts.originalTables >= 1, "retain source tables as collapsed reference");
  assert.match(counts.prose || "", /English source explanation/);
  assert.ok(counts.sharedLinks.some(x=>x.href?.includes("Shared.svg") && x.editions.includes("EN") && x.editions.includes("JA")));
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".hg-attribution")).every(n => n.textContent.includes("Credits available")));
  assert.equal(await page.locator(".hg-details").count(), 4);
  await page.locator(".hg-details summary").first().click();
  assert.ok(await page.locator(".hg-details[open] a[href*=\"oldid=12345\"]").count());
  assert.match(await page.locator(".hg-details[open]").innerText(), /not artifact date/);
  assert.equal(consoleErrors.length, 0, "no browser JavaScript errors");
  await mkdir("test-output", { recursive: true });
  await page.screenshot({ path: "test-output/historical-gallery.png", fullPage: true });
  console.log("PASS: Chromium/mobile viewport, 4 unique glyph files from 3 editions, image attribution, credits and original tables.");
  console.log("Groups: " + JSON.stringify(counts.groups));
} finally {
  if (browser) await browser.close();
  server.kill();
}

