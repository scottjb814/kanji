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

## Experimental historical-form discovery

`historical-forms.js` collects historical glyph tables independently of the
particular Wiktionary heading or edition where they appear. It records the
English, Japanese or Chinese source edition, the heading hierarchy, and the
Wikimedia Commons identity of each image. Its `merge()` helper deduplicates
images by file identity while retaining every source attribution and never
merges distinct image files just because they share a script label.

**The consolidated gallery is now rendered.** Historical images from the
English, Japanese and Chinese entries are merged by Wikimedia Commons file
identity, grouped only when the table's own column labels establish the
script, and displayed near the top of each entry. If the script is uncertain,
the image stays under "Other forms" rather than receiving an inferred date.
Each glyph links to its Commons file information and licence; edition chips
(EN, JA, ZH) link to the originating Wiktionary page and, where available,
the exact source heading. Multiple citations in the same edition are
combined into one labeled chip while retaining their headings in its title.

The prose and cited etymologies remain below the consolidated gallery.
Original Wiktionary forms tables, including text-only variants and source
notes, remain accessible in collapsed detail sections. Wikimedia credits are
calculated after images arrive and cover the unique visible Commons files.

Japanese and Chinese lookups are asynchronous and independently cached.
If one edition fails, the gallery retains the results from available
editions and offers a retry action. No new runtime dependencies, Worker
changes, or hosting changes are required.

The production page uses no extra runtime dependencies. PR checks install a
small **test-only** HTML DOM parser to exercise synthetic page fixtures:

    node --test tests/historical.spec.mjs tests/gallery.spec.mjs

A manual network-dependent check (not in routine CI) is available:

    node tests/live-wiktionary-forms.mjs

The probe fetches English, Japanese and Chinese Wiktionary API responses for
討, 牛 and 字; it prints only image counts and section headings, not copied
dictionary explanations. These checks can become stale as Wiktionary changes.
