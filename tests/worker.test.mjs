import test from "node:test";
import assert from "node:assert/strict";
import worker, { findExactEntry, entryHeadword, parseNaritachi } from "../worker/worker.js";

const SEARCH_PREFIX = '<a href="/kanji/0000000001"><span>学問</span></a> ';
const SEARCH_EXACT = '<a class="hit" href="/kanji/0000000002"><span>学</span></a>';
const PAGE = '<html><head><title>学 | 漢字一字 | 漢字ペディア</title></head><body>' +
  '<li class="naritachi"><div class="hArea"><p>出典：角川新字源</p></div>' +
  '<div><p>学は<img src="/common/images/naritachi/glyph01.gif">の形。</p></div></li></body></html>';

const request = (char = "学", headers = { origin: "https://scottjb814.github.io", authorization: "Bearer test-token" }) =>
  new Request("https://worker.invalid/kp?c=" + encodeURIComponent(char), { headers });

const env = { ALLOWED_ORIGIN: "https://scottjb814.github.io", KP_TOKEN: "test-token" };

async function withResponses(responses, run) {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    const response = responses.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error("Unexpected extra upstream request");
    return response instanceof Response ? response : new Response(response, { status: 200 });
  };
  try { return await run(urls); } finally { globalThis.fetch = original; }
}

test("search requires an exact character match, not the first prefix match", () => {
  assert.equal(findExactEntry(SEARCH_PREFIX + SEARCH_EXACT, "学"), "https://www.kanjipedia.jp/kanji/0000000002");
  assert.equal(findExactEntry(SEARCH_PREFIX, "学"), null);
  assert.equal(findExactEntry('<a href="/kanji/3">&#x5B66;</a>', "学"), "https://www.kanjipedia.jp/kanji/3");
  assert.equal(findExactEntry('<a href="/kanji/3">學</a>', "学"), null);
});

test("entry's title is checked independently of search results", () => {
  assert.equal(entryHeadword(PAGE), "学");
  assert.equal(entryHeadword("<title>學｜漢字一字｜漢字ペディア</title>"), "學");
  assert.equal(entryHeadword("<div>no title</div>"), null);
});

test("extracts attributed text and a restricted glyph-image URL", () => {
  assert.deepEqual(parseNaritachi(PAGE), {
    source: "出典：角川新字源",
    parts: [{ t: "学は" }, { img: "https://www.kanjipedia.jp/common/images/naritachi/glyph01.gif" }, { t: "の形。" }],
  });
});

test("allows minor attribute, quote and paragraph markup variations", () => {
  const markup = "<li id='x' class='other naritachi custom'><div id='a' class='hArea'><p class='small'>典拠&nbsp;A</p></div>\n" +
    "<div class='text'><p class='description'>漢字<b>の</b>構造 <img alt='' src='/common/images/naritachi/x.png'></p></div></li>";
  assert.deepEqual(parseNaritachi(markup), {
    source: "典拠 A", parts: [{ t: "漢字の構造 " }, { img: "https://www.kanjipedia.jp/common/images/naritachi/x.png" }],
  });
});

test("never forwards unknown HTML or unapproved image URLs", () => {
  const markup = '<li class="naritachi"><div class="hArea"><p>典拠</p></div><div><p>字' +
    '<img src="https://evil.invalid/track"><b>安全</b></p></div></li>';
  assert.deepEqual(parseNaritachi(markup), { source: "典拠", parts: [{ t: "字安全" }] });
});

test("missing or malformed なりたち returns null from parser", () => {
  assert.equal(parseNaritachi("<p>Nothing here</p>"), null);
  assert.equal(parseNaritachi('<li class="naritachi"><div>broken</div></li>'), null);
});

test("auth failure sends no upstream requests", async () => {
  await withResponses([], async urls => {
    const response = await worker.fetch(request("学", { origin: env.ALLOWED_ORIGIN }), env);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "unauthorized");
    assert.equal(urls.length, 0);
  });
});

test("other browser origins and invalid input are rejected before fetching", async () => {
  await withResponses([], async urls => {
    assert.equal((await worker.fetch(request("学", { origin: "https://evil.invalid", authorization: "Bearer test-token" }), env)).status, 403);
    assert.equal((await worker.fetch(request("学問"), env)).status, 400);
    assert.equal((await worker.fetch(request("A"), env)).status, 400);
    assert.equal(urls.length, 0);
  });
});

test("correct candidate is fetched and returned", async () => {
  await withResponses([SEARCH_PREFIX + SEARCH_EXACT, PAGE], async urls => {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.found, true);
    assert.equal(data.char, "学");
    assert.equal(data.shown, "学");
    assert.equal(data.url, "https://www.kanjipedia.jp/kanji/0000000002");
    assert.equal(data.naritachi.parts[0].t, "学は");
    assert.equal(urls.length, 2);
    assert.ok(urls[1].endsWith("/kanji/0000000002"));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), env.ALLOWED_ORIGIN);
  });
});

test("prefix-only results do not lead to another character's entry", async () => {
  await withResponses([SEARCH_PREFIX], async urls => {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { found: false, char: "学" });
    assert.equal(urls.length, 1);
  });
});

test("entry redirects or mismatches fail closed", async () => {
  const incorrect = PAGE.replace("<title>学 |", "<title>學 |");
  await withResponses([SEARCH_EXACT, incorrect], async () => {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, "entry_mismatch");
  });
});

test("a malformed なりたち block reports an upstream parsing error", async () => {
  await withResponses([SEARCH_EXACT, PAGE.replace("<div><p>学は<img src=\"/common/images/naritachi/glyph01.gif\">の形。</p></div>", "<div>unexpected layout</div>")], async () => {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, "parse");
  });
});

test("entry without なりたち is distinct from a parser failure", async () => {
  await withResponses([SEARCH_EXACT, PAGE.replace(/<li class="naritachi">[\s\S]*?<\/li>/, "")], async () => {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).naritachi, null);
  });
});

test("upstream failures never leak raw error descriptions", async () => {
  await withResponses([new Response("secret-or-html", { status: 503 })], async () => {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "upstream" });
  });
});

test("upstream timeouts produce an explicit retryable 504", async () => {
  const timeout = new Error("internal details");
  timeout.name = "TimeoutError";
  await withResponses([timeout], async () => {
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), { error: "timeout" });
  });
});
