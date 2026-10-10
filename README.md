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

## Consolidated cross-edition historical forms

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

### One-off visual check

The optional browser smoke test uses **synthetic** English, Japanese and
Chinese Wiktionary API responses, so it does not redistribute dictionary
explanations. To run it locally, install a test-only Playwright package and
Chromium, then run:

    npm install --no-save --no-package-lock playwright@1.55.1
    npx playwright install chromium
    node tests/visual-smoke.mjs

The test serves the site locally at port 8765, uses a 390 px Chromium viewport,
and verifies distinct images, source links, grouped scripts, Commons credits,
and collapsed original tables. It saves a screenshot under
\`test-output/historical-gallery.png\`. Neither Playwright nor the HTML DOM
test dependency is required by the deployed website. The smoke test is not in
regular CI because browser setup is disproportionately costly.


## Per-image provenance

Every consolidated gallery card includes an attribution status and expandable
**Image details**, with a hosting-file link where the identity can be resolved.
`image-provenance.js` batches live Wikimedia file metadata by host and caches it
for the page session. Local Japanese Wiktionary/Wikipedia files have host-qualified
identities; they are not conflated with same-named Commons files. External images
remain visible with source-entry links and an explicit unverified-reuse status.
Metadata failures offer a retry without hiding the glyph or its source links.

Details distinguish digital-image creator, uploader credit/source/description,
reported license, original image, and digital-file version timestamp from ancient
artifact dates. They also retain each Wiktionary page's actual title, revision ID,
and retrieval time. Source categories are preserved without inferring a script
from a filename. Image type is not independently verified; uploader descriptions
are attributed rather than turned into archaeological conclusions.

**Copy attribution** includes available metadata, source revisions, limitations,
and display modifications (resizing and color inversion when dark mode is active).
No dictionary explanations are committed, no AI calls are made, and no Worker
changes are needed. Commons aggregate credits remain explicitly Commons-only;
the per-image panels cover the whole gallery.

Run the deterministic DOM regressions after installing the test-only parser:

    node --test tests/*.spec.mjs

Live metadata availability and layout in real browsers remain separate checks.

## Related-form history and catalogue labels

A shinjitai entry combines its own and its linked kyūjitai's historical-image
sources in the primary gallery. The full traditional-form entry remains in an
expandable section, including readings, source prose, original tables and modern
font samples. Failed traditional-source retrieval leaves the primary entry intact
and can be retried.

Cards and copied attribution identify a single-character label when the hosting
file title follows the character-plus-suffix convention. This is explicitly a
**file character label**, not independently verified historical identification;
unrecognized titles remain unidentified. Script classification still comes from
source-table context, never from filenames. Related files such as 學 and 斆 are
therefore not silently relabeled as 学, and page citations retain their own titles.
