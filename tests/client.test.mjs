import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.split('<script>', 2)[1].split('</script>', 1)[0];
function section(first, last) {
  const start = script.indexOf(first), end = script.indexOf(last, start);
  assert.ok(start >= 0 && end > start, 'source section exists');
  return script.slice(start, end);
}

function node(tag, attrs = {}, ...children) {
  return {
    tag, attrs, children, src: attrs.src, dataset: { k: attrs['data-k'] },
    listeners: {},
    addEventListener(event, cb) { this.listeners[event] = cb; },
    replaceWith(value) { this.replacement = value; },
  };
}

function navigationHarness() {
  const calls = [];
  const location = { href: 'https://example.test/kanji/' };
  const history = {
    pushState(_state, _title, url) { location.href = String(url); },
    replaceState(_state, _title, url) { location.href = String(url); },
  };
  const out = { children: [], replaceChildren(...items) { this.children = items; } };
  const charsBar = { children: [], replaceChildren(...items) { this.children = items; }, append(x) { this.children.push(x); } };
  const q = { value: '' };
  const ctx = { URL, location, history, out, charsBar, q, el: node,
    HAN_G: /\p{Script=Han}/gu, current: null, reqId: 0,
    show(ch) { calls.push(ch); ctx.current = ch; } };
  vm.createContext(ctx);
  vm.runInContext(section('  function setQuery(', '  // ---------- Events ----------'), ctx);
  vm.runInContext(section('  function fromUrl(', '  window.addEventListener("popstate"'), ctx);
  return { ctx, out, charsBar, q, calls, location };
}

test('Back navigation to empty URL clears previous results and selection', () => {
  const h = navigationHarness();
  h.location.href = 'https://example.test/kanji/?q=%E7%89%9B';
  h.ctx.fromUrl();
  assert.equal(h.q.value, '牛');
  assert.deepEqual(h.calls, ['牛']);
  h.location.href = 'https://example.test/kanji/';
  h.ctx.fromUrl();
  assert.equal(h.q.value, '');
  assert.equal(h.ctx.current, null);
  assert.equal(h.charsBar.children.length, 0);
  assert.equal(h.out.children[0].attrs.class, 'empty');
});

test('Invalid non-kanji input invalidates prior asynchronous results', () => {
  const h = navigationHarness();
  h.ctx.reqId = 5;
  h.ctx.setQuery('not a kanji');
  assert.equal(h.ctx.reqId, 6);
  assert.equal(h.ctx.current, null);
  assert.equal(new URL(h.location.href).searchParams.get('q'), 'not a kanji');
  assert.equal(h.out.children[0].attrs.class, 'empty');
});

test('A compound is deduplicated into selectable characters', () => {
  const h = navigationHarness();
  h.ctx.setQuery('牛学牛');
  assert.deepEqual(h.calls, ['牛']);
  assert.equal(h.charsBar.children.length, 2);
  assert.equal(h.charsBar.children[0].attrs['data-k'], '牛');
  assert.equal(h.charsBar.children[1].attrs['data-k'], '学');
});

test('Wikimedia thumbnail error retries the original file, then gives up', () => {
  const ctx = { URL, el: node, imgUrl: src => src };
  vm.createContext(ctx);
  vm.runInContext(section('  function glyphImg(', '  function expand('), ctx);
  const img = ctx.glyphImg('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Glyph.svg/150px-Glyph.svg');
  img.listeners.error();
  assert.equal(img.src, 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Glyph.svg');
  img.listeners.error();
  assert.equal(img.replacement.attrs.class, 'missing');
});


function kpHarness(status, responseData) {
  let calls = 0;
  const ctx = {
    kpCfg: { url: "https://example.workers.dev", token: "unit-test-secret" },
    kpCache: new Map(),
    fetch: async () => {
      calls++;
      return { status, ok: status >= 200 && status < 300, json: async () => responseData };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(section("  function lookupKp(", "  // Replace a card with a loading card"), ctx);
  return { lookup: ch => ctx.lookupKp(ch), calls: () => calls };
}

test("Kanjipedia title mismatch displays a meaningful error and is retryable", async () => {
  const h = kpHarness(502, { error: "entry_mismatch" });
  await assert.rejects(h.lookup("学"), /different character/);
  await assert.rejects(h.lookup("学"), /different character/);
  assert.equal(h.calls(), 2);
});

test("Kanjipedia timeout displays a meaningful retryable error", async () => {
  const h = kpHarness(504, { error: "timeout" });
  await assert.rejects(h.lookup("討"), /too long to respond/);
});

test("Kanjipedia malformed success payload is rejected rather than shown as missing", async () => {
  const h = kpHarness(200, { nonsense: true });
  await assert.rejects(h.lookup("学"), /unexpected response/);
});

test("Kanjipedia invalid token is treated as a reconfiguration problem", async () => {
  const h = kpHarness(401, { error: "unauthorized" });
  assert.equal((await h.lookup("討")).denied, true);
});
