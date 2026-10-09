# Kanji Origins — Project Status

**Last updated:** 2026-10-09  
**Repository:** https://github.com/scottjb814/kanji  
**Live site:** https://scottjb814.github.io/kanji/  
**Cloudflare Worker:** https://kanji-kp.scottjb814.workers.dev/

> This is a *snapshot of current implementation and priorities*, not a substitute for the Project Instructions. For a new development conversation, read this file, then inspect the current GitHub `main` branch, open PRs, and latest Actions runs before acting. Update this file after significant development or deployment.

## Production baseline

- **Latest verified GitHub Pages release:** `main` commit [`06cd0528ef3366cca2ba89d142b6614ab4e4f747`](https://github.com/scottjb814/kanji/commit/06cd0528ef3366cca2ba89d142b6614ab4e4f747), merged through PR #4 on October 9, 2026.
- **Pages publication:** [Build and deploy run 37865140586](https://github.com/scottjb814/kanji/actions/runs/37865140586) completed successfully (including the Pages deployment job).
- **Post-merge checks:** [Run 37865140596](https://github.com/scottjb814/kanji/actions/runs/37865140596) passed.
- **Published assets independently checked:** [Run 37865217495](https://github.com/scottjb814/kanji/actions/runs/37865217495) received HTTP 200 for the home page, `historical-forms.js`, and `data/shuowen_index.json`, and confirmed the deployed HTML/JS contains the consolidated gallery code.
- **Browser verification scope:** A 390-pixel Chromium check with *synthetic* Wiktionary responses verified grouping, cross-edition deduplication, provenance links, credits, and original tables ([run 37863267835](https://github.com/scottjb814/kanji/actions/runs/37863267835)). This is **not** a claim of interactive browser verification of every live production entry.
- **Cloudflare Worker:** Deployed separately by the site owner. [Eight token-free live checks](https://github.com/scottjb814/kanji/actions/runs/37864459489) passed (authentication, CORS, and error handling). The site owner subsequently confirmed authenticated Kanjipedia なりたち displayed successfully. Worker source changes in GitHub do **not** automatically deploy to Cloudflare.

## Recently completed work

| PR | Status | Outcome |
| --- | --- | --- |
| [#1](https://github.com/scottjb814/kanji/pull/1) | Merged | Navigation, stale-request handling, loading behavior, image fallback, and regression checks |
| [#2](https://github.com/scottjb814/kanji/pull/2) | Merged | Kanjipedia exact-character matching, entry validation, structured failures, and timeouts |
| [#3](https://github.com/scottjb814/kanji/pull/3) | Merged | Historical-form discovery across English, Japanese, and Chinese Wiktionary; image identities and source paths |
| [#4](https://github.com/scottjb814/kanji/pull/4) | Merged | Consolidated gallery, conservative script grouping, Commons/source links, original tables, and partial-result handling |

No outstanding *feature* PRs were open when this status snapshot was prepared. Check the [current pull request list](https://github.com/scottjb814/kanji/pulls), including the documentation PR introducing this file.

## Current implementation

- Static, dependency-light GitHub Pages application: `index.html`, `historical-forms.js`, CSS, and vanilla JavaScript.
- Live MediaWiki responses from English/Japanese/Chinese Wiktionary; historical forms are deduplicated by Commons file identity while retaining edition and section attribution. Source etymologies and original tables remain accessible.
- KANJIDIC2 data is generated during deployment; 說文解字 uses a committed index and Wikisource.
- Optional Kanjipedia なりたち uses the separately deployed private Cloudflare Worker. The Worker token stays in browser local storage; never put it in files, chat logs, tests, or commits.
- Modern calligraphic/typeface samples are **separate from historical evidence**. Current font choices and glyph-coverage logic are in `index.html`; do not copy coverage assumptions between fonts.
- Existing testing includes deterministic Python and Node regression checks; optional live API and browser smoke tests are documented in `README.md` and `worker/README.md`.

## Next priorities

1. **Japanese calligraphy enhancement (next candidate; not implemented):** Evaluate **Yuji Boku** as a visually distinct modern brush-style font. First verify the upstream repository/version, SIL OFL terms, Japanese glyph shapes, precise kanji coverage, visual quality, and loading cost. Prefer a single-font, lazy-loaded experiment in the existing expandable calligraphy section; keep explicit missing-glyph behavior. Open a focused draft PR with tests and visual samples before proposing a merge. The user prioritizes calligraphy over stroke-order animation.
2. **Post-release visual evaluation:** Inspect real live entries for 討, 牛, 字, 悪/惡, and 学/學 on desktop/mobile. Check classification, image provenance, accessibility, failed-image behavior, and text-only historical forms. This manual review has not been recorded as complete.
3. **Source and variant reliability:** Improve only when specific evidence shows a gap, especially upstream Wiktionary HTML changes, Japanese traditional/new-form relationships, and cross-edition source attribution. Preserve uncertainty rather than inventing script dates or conflating inscriptions.

## Known risks and boundaries

- **No confirmed open production bug is recorded here.** The manual gallery review and potential font work are follow-ups, not established defects.
- Upstream Wiktionary/other dictionary markup and API behavior can change. Synthetic tests cannot prove current live parsing for every character.
- Character variants and palaeographic classifications require evidence; Chinese/Japanese appearance must not be assumed identical.
- Wikimedia Commons file attribution and individual image licences matter. Keep original source links and do not commit third-party dictionary prose where redistribution permission is uncertain.
- Font fallback can misrepresent what typeface a glyph actually comes from. Verify `cmap` coverage and rendering for Japanese-specific forms.
- Successful CI, successful Pages publication, published-asset HTTP checks, and real browser interaction are **different verification levels**. State which actually ran.
- Keep heavy browser checks and network-dependent integration checks optional where possible.

## Decisions and working conventions

- Favor static HTML/CSS/vanilla JS, live public sources, and small targeted changes over new frameworks/services.
- Preserve historical evidence, etymological commentary, and modern calligraphy as clearly separated content types.
- Prioritize artistic calligraphy rather than introducing a stroke-order tutorial.
- For substantive work: review current code and PRs, use a feature branch, add deterministic tests, run CI, and open a draft PR. **Do not merge or deploy without authorization** unless the request expressly includes that action.
- When authorized to merge stacked PRs, respect dependency order and verify the resulting Pages assets.
- Never deploy the Cloudflare Worker or change its secrets/configuration without separate explicit authorization.

## Updating this file

After a significant development phase, update the date, production commit, exact verification evidence, merged/open PRs, completed work, new decisions, and current priorities. Remove stale priorities rather than accumulating a long narrative. Keep detailed procedures in `README.md` and permanent principles in the ChatGPT Project Instructions.
