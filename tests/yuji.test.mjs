import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const src=html.slice(html.indexOf('  const BRUSH_INLINE'),html.indexOf('  const brushCss'));
const ctx={atob,Uint8Array,Set};vm.createContext(ctx);vm.runInContext(src,ctx);
const coverage=JSON.parse(readFileSync(new URL('../fonts/yuji-boku/coverage.json',import.meta.url)));
test('Readable Klee reference comes first, Yuji replaces LXGW, cursive comes last',()=>{
 const names=vm.runInContext('BRUSH_FONTS.map(f=>f.fam)',ctx);
 assert.deepEqual(Array.from(names),['Klee One','Yuji Boku','Kouzan Brush','Liu Jian Mao Cao']);
 assert.ok(!html.includes('LXGW'));assert.ok(html.includes('family=Yuji+Boku'));
});
test('Yuji coverage exactly matches its nonblank source glyphs',()=>{
 const usable=new Set(coverage.usable_han);
 for(let cp=0x3400;cp<=0xFAFF;cp++)assert.equal(ctx.brushHas('yb',cp),usable.has(cp),'U+'+cp.toString(16));
 for(const ch of '絆討悪鬱學剝綻')assert.equal(ctx.brushHas('yb',ch.codePointAt(0)),true);
 for(const ch of '𠮟𠮷')assert.equal(ctx.brushHas('yb',ch.codePointAt(0)),false);
});
