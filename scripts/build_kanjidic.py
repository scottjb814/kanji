#!/usr/bin/env python3
"""Build data/kanjidic.json for the glyph-origin page from KANJIDIC2.

Source: the latest KANJIDIC2 (English) release from scriptin/jmdict-simplified,
a JSON conversion of EDRDG's KANJIDIC2 XML.

KANJIDIC2 is the property of the Electronic Dictionary Research and Development
Group (EDRDG) and is used under its licence (CC BY-SA 4.0):
https://www.edrdg.org/edrdg/licence.html
The output file is a derived work under the same licence. SKIP codes, which
carry a separate licence, are not included.

Usage: python3 build_kanjidic.py OUTPUT_PATH     (standard library only)
"""
import io, json, os, sys, tarfile, urllib.parse, urllib.request

REPO = "https://github.com/scriptin/jmdict-simplified"
UA = {"User-Agent": "kanji-glyph-page-builder (personal GitHub Pages site)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=120)


def latest_tag():
    # /releases/latest redirects to /releases/tag/<tag>; no API token needed.
    with get(f"{REPO}/releases/latest") as r:
        return urllib.parse.unquote(r.geturl().rstrip("/").rsplit("/", 1)[1])


def load_source(tag):
    name = f"kanjidic2-en-{tag}.json.tgz"
    url = f"{REPO}/releases/download/{urllib.parse.quote(tag, safe='')}/{urllib.parse.quote(name)}"
    with get(url) as r:
        blob = r.read()
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tf:
        member = next(m for m in tf.getmembers() if m.name.endswith(".json"))
        return json.load(tf.extractfile(member))


def trim(src):
    # Map JIS codes to characters so variant references become characters.
    by_code = {}
    for c in src["characters"]:
        for cp in c["codepoints"]:
            if cp["type"].startswith("jis"):
                by_code[(cp["type"], cp["value"])] = c["literal"]

    out = {}
    for c in src["characters"]:
        rm = c.get("readingMeaning") or {}
        groups = rm.get("groups", [])
        misc = c["misc"]
        moro = next((d for d in c["dictionaryReferences"] if d["type"] == "moro"), None)
        mo = None
        if moro:
            mo = moro["value"]
            if moro.get("morohashi"):
                mo += f" ({moro['morohashi']['volume']}:{moro['morohashi']['page']})"
        variants = []
        for v in misc.get("variants", []):
            ch = by_code.get((v["type"], v["value"]))
            if ch and ch != c["literal"] and ch not in variants:
                variants.append(ch)
        rec = {
            "o": [r["value"] for g in groups for r in g["readings"] if r["type"] == "ja_on"],
            "k": [r["value"] for g in groups for r in g["readings"] if r["type"] == "ja_kun"],
            "n": rm.get("nanori", []),
            "m": [m["value"] for g in groups for m in g["meanings"] if m["lang"] == "en"],
            "s": (misc.get("strokeCounts") or [None])[0],
            "f": misc.get("frequency"),
            "r": next((r["value"] for r in c["radicals"] if r["type"] == "classical"), None),
            "v": variants,
            "mo": mo,
        }
        out[c["literal"]] = {k: v for k, v in rec.items() if v not in (None, [], "")}
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: build_kanjidic.py OUTPUT_PATH")
    tag = latest_tag()
    src = load_source(tag)
    data = {
        "_meta": {
            "source": "KANJIDIC2, Electronic Dictionary Research and Development Group",
            "licence": "CC BY-SA 4.0 — https://www.edrdg.org/edrdg/licence.html",
            "project": "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
            "conversion": f"{REPO} {tag}",
            "dictDate": src.get("dictDate"),
        },
        "chars": trim(src),
    }
    os.makedirs(os.path.dirname(os.path.abspath(sys.argv[1])), exist_ok=True)
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(data['chars'])} characters (KANJIDIC2 {src.get('dictDate')}, release {tag}).")


if __name__ == "__main__":
    main()
