# Kanji Origins — Project Status

**Last updated:** 2026-10-10 (America/Los_Angeles)  
**Repository:** https://github.com/scottjb814/kanji  
**Live site:** https://scottjb814.github.io/kanji/  
**Cloudflare Worker:** https://kanji-kp.scottjb814.workers.dev/

> This is a *snapshot of current implementation and priorities*, not a substitute for the Project Instructions. For a new development conversation, read this file, then inspect the current GitHub `main` branch, open PRs, and latest Actions runs before acting. Update this file after significant development or deployment.

## Production baseline

- **Latest successful GitHub Pages deployment:** `main` commit [`4184e25676abeada5cd63b06d6682c384ef079ad`](https://github.com/scottjb814/kanji/commit/4184e25676abeada5cd63b06d6682c384ef079ad), merged through PR #10 on October 10, 2026.
- **Pages publication:** [Build and deploy run 38099578679](https://github.com/scottjb814/kanji/actions/runs/38099578679) passed; both build and deploy jobs were checked during this refresh.
- **Post-merge checks:** [Run 38099578700](https://github.com/scottjb814/kanji/actions/runs/38099578700) passed for the same commit.
- **Published assets checked:** After the PR #10 deployment, the live HTML returned HTTP 200 and its Other accounts calls were verified in the order KP, JA, ZH, MOE, SW. `historical-forms.js`, `image-provenance.js`, `data/shuowen_index.json`, and deployment-generated `data/kanjidic.json` also returned HTTP 200. No interactive browser check was performed for this release.
- **Earlier browser evidence:** The previous snapshot records a 390-pixel Chromium test with synthetic Wiktionary responses ([run 37863267835](https://github.com/scottjb814/kanji/actions/runs/37863267835)), covering grouping, deduplication, links, credits, and original tables. This is historical evidence, not a new live-site check.
- **Cloudflare Worker (prior snapshot; not rechecked):** Deployed separately by the site owner. [Eight token-free live checks](https://github.com/scottjb814/kanji/actions/runs/37864459489) passed (authentication, CORS, and error handling). The site owner subsequently confirmed authenticated Kanjipedia なりたち displayed successfully. Worker source changes in GitHub do **not** automatically deploy to Cloudflare.

## Recently completed work

| PR | Status | Outcome |
| --- | --- | --- |
| [#1](https://github.com/scottjb814/kanji/pull/1) | Merged | Navigation, stale-request handling, loading behavior, image fallback, and regression checks |
| [#2](https://github.com/scottjb814/kanji/pull/2) | Merged | Kanjipedia exact-character matching, entry validation, structured failures, and timeouts |
| [#3](https://github.com/scottjb814/kanji/pull/3) | Merged | Historical-form discovery across English, Japanese, and Chinese Wiktionary; image identities and source paths |
| [#4](https://github.com/scottjb814/kanji/pull/4) | Merged | Consolidated gallery, conservative script grouping, Commons/source links, original tables, and partial-result handling |
| [#6](https://github.com/scottjb814/kanji/pull/6) | Merged | Per-image provenance, host-qualified image identities, and reusable attribution |
| [#7](https://github.com/scottjb814/kanji/pull/7) | Merged | Catalogue character labels and related kyūjitai history in the primary gallery |
| [#8](https://github.com/scottjb814/kanji/pull/8) | Merged | Lazy-loaded Kouzan brush font with explicit glyph-coverage checks |
| [#9](https://github.com/scottjb814/kanji/pull/9) | Merged | Yuji Boku replaces LXGW; modern brush samples reordered |

## Release and documentation status

- [PR #10](https://github.com/scottjb814/kanji/pull/10) is merged and deployed. Other accounts now appears as Kanjipedia → ja.Wiktionary → zh.Wiktionary → Taiwan MOE → zh.Wikisource (說文解字), preserving independent loading, optional-source flags, retries, and the final link-only dictionary card. Five new DOM regression cases cover ordering, missing entries, multiple Wiktionary blocks, failures/retries, and optional sources. Both PR checks and the post-merge suite passed.
- [PR #5](https://github.com/scottjb814/kanji/pull/5) introduces this status document. The user authorized its merge together with deployment. The baseline above records the verified application release immediately before this documentation-only merge; the documentation merge triggers another Pages run without changing application assets.
- No other feature PR was open when this release was checked. Consult the current PR list before starting new work.

## Current implementation

- Static, dependency-light GitHub Pages application: `index.html`, `historical-forms.js`, `image-provenance.js`, CSS, and vanilla JavaScript.
- Live MediaWiki responses from English/Japanese/Chinese Wiktionary; historical forms are deduplicated by hosting-file identity while retaining edition and section attribution. Same-named files on different hosts remain distinct. Source etymologies and original tables remain accessible.
- Per-image details and copied attribution distinguish digital-file metadata from ancient artifact evidence. Primary galleries include linked kyūjitai sources; catalogue character labels do not establish historical identification.
- KANJIDIC2 data is generated during deployment; 說文解字 uses a committed index and Wikisource.
- Optional Kanjipedia なりたち uses the separately deployed private Cloudflare Worker. The Worker token stays in browser local storage; never put it in files, chat logs, tests, or commits.
- Modern calligraphic/typeface samples are **separate from historical evidence**: Klee One → Yuji Boku → Kouzan Brush → Liu Jian Mao Cao. Yuji Boku and self-hosted, lazy-loaded Kouzan have explicit coverage data; missing glyphs must not silently fall back. Current implementation and license notes are in `index.html`, `README.md`, and `fonts/`.
- Existing testing includes deterministic Python and Node regression checks; optional live API and browser smoke tests are documented in `README.md` and `worker/README.md`.

## Next priorities

1. **Post-release visual evaluation:** Inspect real live entries for 討, 牛, 字, 悪/惡, and 学/學 on desktop/mobile. Check classification, image provenance, accessibility, failed-image behavior, and text-only historical forms. This manual review has not been recorded as complete.
2. **Source and variant reliability:** Improve only when specific evidence shows a gap, especially upstream Wiktionary HTML changes, Japanese traditional/new-form relationships, and cross-edition source attribution. Preserve uncertainty rather than inventing script dates or conflating inscriptions.

## Known risks and boundaries

- **No confirmed open production bug is recorded here.** The manual gallery review is a follow-up, not an established defect; PR #10 is a source-presentation preference.
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
