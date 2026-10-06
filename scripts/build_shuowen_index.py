#!/usr/bin/env python3
"""Build data/shuowen_index.json: which page of 說文解字 on zh.Wikisource
holds each headword, and under which 部.

Note: the zh.Wikisource transcription omits 重文 (the variant forms listed at
the end of many entries; e.g. 學 under 斆 is absent), so a character that is
only a 重文 has no entry here.

The index holds no 說文 text, only locations ({"牛": [2, "牛部"], ...}). The
page fetches the one page it needs at lookup time. The work itself is not
expected to change, so the output is committed; re-run only if zh.Wikisource
reorganises the pages.

Stdlib only. Usage: python3 scripts/build_shuowen_index.py [out.json]
"""
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

API = "https://zh.wikisource.org/w/api.php"
UA = "KanjiLookupPersonal/1.0 (https://github.com/scottjb814/kanji; personal use)"
PAGES = range(1, 16)  # 說文解字/01 .. /15


def fetch_page(n):
    q = urllib.parse.urlencode({
        "action": "parse", "page": f"說文解字/{n:02d}", "prop": "text",
        "disableeditsection": "1", "format": "json", "formatversion": "2",
    })
    req = urllib.request.Request(f"{API}?{q}", headers={
        "User-Agent": UA, "Accept-Encoding": "gzip"})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                return json.loads(data)["parse"]["text"]
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(15 * (attempt + 1))
                continue
            raise
    raise RuntimeError(f"gave up on page {n}")


class Scan(HTMLParser):
    """Walk the page: remember the current 部 (h2) and each paragraph's text."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.bu = ""
        self.in_h2 = False
        self.h2_id = None
        self.in_p = False
        self.p_text = []
        self.skip = 0          # inside <style>/<script>/<table>
        self.entries = []      # (headword, bu)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("style", "script", "table"):
            self.skip += 1
        elif tag == "h2":
            self.in_h2, self.h2_id = True, None
        elif tag == "span" and self.in_h2 and a.get("id", "").startswith("."):
            pass
        elif tag == "p":
            self.in_p, self.p_text = True, []

    def handle_endtag(self, tag):
        if tag in ("style", "script", "table"):
            self.skip = max(0, self.skip - 1)
        elif tag == "h2":
            self.in_h2 = False
        elif tag == "p" and self.in_p:
            self.in_p = False
            txt = "".join(self.p_text).lstrip()
            # Entry shape: "牛（<seal image>）：…" or "牡：…". The seal image
            # contributes no text, so "（）" may appear.
            m = re.match(r"(.)(?:（[^）]*）)?：", txt, re.S)
            if m and self.bu:
                self.entries.append((m.group(1), self.bu))

    def handle_data(self, data):
        if self.skip:
            return
        if self.in_h2:
            t = data.strip()
            if t:
                self.bu = t
        elif self.in_p:
            self.p_text.append(data)


def main(out):
    index, dupes = {}, 0
    for n in PAGES:
        s = Scan()
        s.feed(fetch_page(n))
        for ch, bu in s.entries:
            if ch in index:
                dupes += 1
                continue
            index[ch] = [n, bu]
        print(f"說文解字/{n:02d}: {len(s.entries)} entries", file=sys.stderr)
        time.sleep(6)
    print(f"{len(index)} headwords, {dupes} repeated headwords skipped", file=sys.stderr)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"_meta": {"source": "zh.wikisource.org 說文解字/01-15"}, "chars": index},
                  f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/shuowen_index.json")
