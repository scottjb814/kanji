import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaritachi } from '../worker/worker.js';

test('extracts text, glyph images and source', () => {
 const html = '<li class="naritachi"><div class="hArea"><p>出典：角川新字源</p></div><div><p>牛は<img src="/common/images/naritachi/glyph01.gif">の形。</p></div></li>';
 assert.deepEqual(parseNaritachi(html), {source:'出典：角川新字源',parts:[{t:'牛は'},{img:'https://www.kanjipedia.jp/common/images/naritachi/glyph01.gif'},{t:'の形。'}]});
});
test('no entry means null', () => assert.equal(parseNaritachi('<html>No entry</html>'),null));
test('decodes named and numeric entities', () => {
 const html = '<li class="naritachi"><div class="hArea"><p>出典 &amp; 資料</p></div><div><p>&#x725B; &lt;形&gt;</p></div></li>';
 assert.deepEqual(parseNaritachi(html),{source:'出典 & 資料',parts:[{t:'牛 <形>'}]});
});
