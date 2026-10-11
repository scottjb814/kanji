import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function section(first, last) {
  const start = html.indexOf(first), end = html.indexOf(last, start);
  assert.ok(start >= 0 && end > start);
  return html.slice(start, end);
}
const expected = ['Kanjipedia', 'ja.Wiktionary', 'zh.Wiktionary', 'Taiwan MOE', 'zh.Wikisource'];
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(kp = true, moe = true) {
  const { document } = parseHTML('<html><body></body></html>');
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  }
  const pending = new Map(), calls = [];
  const ctx = { el, KP_INLINE: kp, MOE_INLINE: moe,
    dictCard: () => el('div', { class: 'wide', text: 'Read in the original' }) };
  for (const [i, [prefix, lookup, render]] of [
    ['KP', 'lookupKp', 'renderKp'], ['JA', 'lookupJa', 'renderJa'],
    ['ZH', 'lookupZh', 'renderZh'], ['MOE', 'lookupMoe', 'renderMoe'],
    ['SW', 'shuowenFor', 'renderSw']
  ].entries()) {
    const title = expected[i];
    ctx[prefix + '_T'] = [title, 'Source type'];
    ctx[lookup] = ch => {
      calls.push([title, ch]);
      return new Promise((resolve, reject) => pending.set(title, { resolve, reject }));
    };
    ctx[render] = result => {
      const fragment = document.createDocumentFragment();
      for (let n = 0; n < (result.blocks || 1); n++) {
        const card = ctx.srcBlock(title, 'Source type');
        card.append(el('p', { text: result.none ? 'No entry' : 'Synthetic result' }));
        fragment.append(card);
      }
      return fragment;
    };
  }
  vm.createContext(ctx);
  vm.runInContext(section('  function srcBlock(', '  const prose ='), ctx);
  vm.runInContext(section('  function extrasFor(', '  // ---------- Code point'), ctx);
  const wrap = ctx.extrasFor('学', '學');
  document.body.append(wrap);
  const grid = wrap.querySelector('.accounts');
  const titles = () => Array.from(grid.querySelectorAll(':scope > .acct > h3'), h => h.lastChild.textContent);
  return { pending, calls, grid, titles };
}

test('Other accounts reserves the requested order and keeps it through asynchronous results', async () => {
  const f = fixture();
  assert.deepEqual(f.titles(), expected);
  assert.deepEqual(f.calls, expected.map(title => [title, '学']));
  assert.equal(f.grid.querySelectorAll('.muted').length, 5);
  // The last source arrives first, with no entry; JA returns two account blocks.
  for (const title of [...expected].reverse()) {
    f.pending.get(title).resolve({ none: title === 'zh.Wikisource', blocks: title === 'ja.Wiktionary' ? 2 : 1 });
    await flush();
  }
  assert.deepEqual(f.titles(), [expected[0], expected[1], expected[1], ...expected.slice(2)]);
  assert.match(f.grid.lastElementChild.textContent, /Read in the original/);
  assert.match(f.grid.children[f.grid.children.length - 2].textContent, /No entry/);
});

test('failed source and its retry retain their reserved position', async () => {
  const f = fixture();
  f.pending.get('Kanjipedia').reject(new Error('synthetic network failure'));
  await flush();
  assert.deepEqual(f.titles(), expected);
  f.grid.querySelector('.retry').click();
  assert.deepEqual(f.titles(), expected);
  f.pending.get('Kanjipedia').resolve({});
  await flush();
  assert.deepEqual(f.titles(), expected);
  assert.equal(f.grid.querySelector('.retry'), null);
  assert.equal(f.calls.filter(([title]) => title === 'Kanjipedia').length, 2);
});

for (const [kp, moe] of [[false, true], [true, false], [false, false]]) {
  test(`optional source flags preserve relative order (KP=${kp}, MOE=${moe})`, () => {
    const f = fixture(kp, moe);
    const enabled = expected.filter(title => (kp || title !== 'Kanjipedia') && (moe || title !== 'Taiwan MOE'));
    assert.deepEqual(f.titles(), enabled);
    assert.deepEqual(f.calls.map(([title]) => title), enabled);
    assert.match(f.grid.lastElementChild.textContent, /Read in the original/);
  });
}
