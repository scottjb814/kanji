# Kanji glyph origins

Personal research site: https://scottjb814.github.io/kanji/

## Architecture
GitHub Pages hosts plain HTML, CSS, and JavaScript (index.html). No LLM API or frontend framework is required.

- English, Japanese, Chinese Wiktionary: live MediaWiki API responses parsed in the browser.
- 說文解字: a committed index at data/shuowen_index.json, plus live Wikisource pages.
- KANJIDIC2: rebuilt during GitHub Pages deployment by scripts/build_kanjidic.py.
- Taiwan MOE 異體字字典: optional live dictionary excerpts (review reuse terms before publishing).
- Kanjipedia: optional Cloudflare Worker; see worker/README.md. NEVER commit the private token.
- Saved characters and Worker credentials use browser localStorage; they are not synchronized.

## Maintenance
Run tests before proposing a merge:

    python3 -m unittest discover -s tests -p 'test_*.py'
    node --test tests/*.test.mjs

Verify the inline JavaScript syntax and check representative lookups: 討, 悪, 葛, 学, 學, 牛, 斆, multiple kanji input, empty input, Back/Forward navigation, dark mode, and mobile viewport.

GitHub Actions deploys from main and refreshes KANJIDIC2 monthly. Feature branches do not change the live site.

Some dictionary HTML extractors depend on upstream markup. A successful deployment alone does not guarantee that all lookups continue to parse correctly.
