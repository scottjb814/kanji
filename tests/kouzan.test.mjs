import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const src=html.slice(html.indexOf('  const BRUSH_INLINE'),html.indexOf('  const brushCss'));
const ctx={atob,Uint8Array,Set};vm.createContext(ctx);vm.runInContext(src,ctx);
const coverage=JSON.parse(readFileSync(new URL('../fonts/kouzan/coverage.json',import.meta.url)));
test('Kouzan coverage matches every usable glyph and excludes blank and absent forms',()=>{
 const usable=new Set(coverage.usable_han);
 for(let cp=0x3400;cp<=0xFAFF;cp++)assert.equal(ctx.brushHas('kz',cp),usable.has(cp),'U+'+cp.toString(16));
 for(const ch of '絆討悪葛藤鬱龍竜學学國国體体邊辺齋斎髙﨑')assert.equal(ctx.brushHas('kz',ch.codePointAt(0)),true);
 for(const ch of '剝𠮟𠮷綻詓餺鰙')assert.equal(ctx.brushHas('kz',ch.codePointAt(0)),false);
});
test('All Unicode-range chunks exist and cover glyphs exactly once',()=>{
 const css=readFileSync(new URL('../fonts/kouzan/kouzan.css',import.meta.url),'utf8');
 for(const chunk of coverage.chunks){assert.ok(existsSync(new URL('../fonts/kouzan/'+chunk.file,import.meta.url)));assert.ok(css.includes(chunk.file));assert.ok(chunk.bytes<300000);}
 for(const cp of coverage.usable_han)assert.equal(coverage.chunks.filter(c=>cp>=c.start&&cp<=c.end).length,1);
 assert.ok(html.includes('brushStyles(f.css || BRUSH_CSS)'));
});
