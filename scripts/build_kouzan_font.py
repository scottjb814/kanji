"""Generate Unicode-range WOFF2 chunks from the official Kouzan TrueType font.
Requires fonttools and brotli. Usage: python scripts/build_kouzan_font.py FONT.ttf
"""
import sys, json, hashlib
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
src = Path(sys.argv[1]); out = Path(__file__).resolve().parents[1] / 'fonts/kouzan'
out.mkdir(parents=True, exist_ok=True)
f = TTFont(src); cmap = f.getBestCmap()
blocks = [(0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF)]
usable = sorted(cp for cp,g in cmap.items() if any(a <= cp <= b for a,b in blocks) and f['glyf'][g].numberOfContours != 0)
groups = {}
for cp in usable: groups.setdefault(cp // 1024, []).append(cp)
css = []; chunks = []
for key,cps in groups.items():
 font = TTFont(src)
 # Original gasp has trailing invalid bytes; mort is obsolete Apple layout.
 for tag in ['gasp','mort']:
  if tag in font: del font[tag]
 opts = subset.Options(); sub = subset.Subsetter(options=opts); sub.populate(unicodes=cps); sub.subset(font)
 name = f'kouzan-{key:02x}.woff2'; font.flavor = 'woff2'; font.save(out/name)
 check = TTFont(out/name)
 assert set(check.getBestCmap()) == set(cps)
 assert all(f['glyf'][cmap[cp]].compile(f['glyf']) == check['glyf'][check.getBestCmap()[cp]].compile(check['glyf']) for cp in cps)
 start,end = key*1024, key*1024+1023
 css.append(f"@font-face{{font-family:'Kouzan Brush';src:url('{name}') format('woff2');font-weight:400;font-style:normal;font-display:swap;unicode-range:U+{start:X}-{end:X};}}")
 chunks.append({'file':name,'bytes':(out/name).stat().st_size,'start':start,'end':end,'characters':len(cps)})
(out/'kouzan.css').write_text('\n'.join(css)+'\n')
(out/'coverage.json').write_text(json.dumps({'source':'https://opentype.jp/bin/KouzanMouhituFont.zip','source_ttf_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'usable_han':usable,'excluded_blank':['綻','詓','餺','鰙'],'chunks':chunks},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'usable_han':len(usable),'chunks':len(chunks),'total_bytes':sum(c['bytes'] for c in chunks),'largest_chunk':max(c['bytes'] for c in chunks)}))
