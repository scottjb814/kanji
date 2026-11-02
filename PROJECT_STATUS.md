# Kanji Origins — Project Status

**Last updated:** 2026-11-02 (America/Los_Angeles)
**Repository:** https://github.com/scottjb814/kanji  
**Live site:** https://scottjb814.github.io/kanji/  
**Cloudflare Worker:** https://kanji-kp.scottjb814.workers.dev/

> This is a *snapshot of current implementation and priorities*, not a substitute for the Project Instructions. For a new development conversation, read this file, then inspect the current GitHub `main` branch, open PRs, and latest Actions runs before acting. Update this file after significant development or deployment.

## Production baseline

- **Application release:** `main` commit [`322f98bcd22a503085ac04b43285cb9633345402`](https://github.com/scottjb814/kanji/commit/322f98bcd22a503085ac04b43285cb9633345402), merged through [PR #11](https://github.com/scottjb814/kanji/pull/11) on November 2, 2026.
- **Pages publication:** [Build and deploy run 41514765267](https://github.com/scottjb814/kanji/actions/runs/41514765267) passed; both build and deploy jobs succeeded.
- **Post-merge checks:** [Run 41514765236](https://github.com/scottjb814/kanji/actions/runs/41514765236) passed for the same commit. PR validation passed 74 Node regressions, 1 Python conversion test, and the real Chromium PWA smoke test using synthetic dictionary data.
- **Live browser verification:** The published page displayed “Basic offline data is ready on this device,” indicating successful service-worker installation and required local-asset precaching. A real 牛 lookup displayed KANJIDIC readings and meanings, historical forms, and source links. Physical phone installation and offline operation of the production site were not tested; offline launch, saved characters, navigation, missing-data recovery, and update activation were verified in the synthetic Chromium smoke test.
- **Cloudflare Worker:** Unchanged by this release and deployed separately by the site owner. Prior token-free checks and the owner's authenticated Kanjipedia confirmation remain the latest recorded Worker verification.
- This status-only refresh follows the application release and triggers another Pages build without changing the application's source assets.

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
- [PR #5](https://github.com/scottjb814/kanji/pull/5) merged the project-status document on October 10, 2026.
- [PR #11](https://github.com/scottjb814/kanji/pull/11) merged and deployed the installable app with basic offline readings on November 2, 2026. Installation metadata, icons, scoped local caching, release versioning, offline fallback, and an update/reload action are implemented. Historical sources, images, online fonts, and private Kanjipedia responses remain online-only.

## Current implementation

- Installable PWA with basic offline interface and KANJIDIC data. The footer confirms the initial download. Browser storage may be cleared or evicted; installation adds no synchronization. All PWA assets are explicitly included in Pages assembly, and a content digest versions each release, including monthly dictionary refreshes.
- Static, dependency-light GitHub Pages application: `index.html`, `historical-forms.js`, `image-provenance.js`, CSS, and vanilla JavaScript.
- Live MediaWiki responses from English/Japanese/Chinese Wiktionary; historical forms are deduplicated by hosting-file identity while retaining edition and section attribution. Same-named files on different hosts remain distinct. Source etymologies and original tables remain accessible.
- Per-image details and copied attribution distinguish digital-file metadata from ancient artifact evidence. Primary galleries include linked kyūjitai sources; catalogue character labels do not establish historical identification.
- KANJIDIC2 data is generated during deployment; 說文解字 uses a committed index and Wikisource.
- Optional Kanjipedia なりたち uses the separately deployed private Cloudflare Worker. The Worker token stays in browser local storage; never put it in files, chat logs, tests, or commits.
- Modern calligraphic/typeface samples are **separate from historical evidence**: Klee One → Yuji Boku → Kouzan Brush → Liu Jian Mao Cao. Yuji Boku and self-hosted, lazy-loaded Kouzan have explicit coverage data; missing glyphs must not silently fall back. Current implementation and license notes are in `index.html`, `README.md`, and `fonts/`.
- Existing testing includes deterministic Python and Node regression checks; optional live API and browser smoke tests are documented in `README.md` and `worker/README.md`.

## Next priorities

- **[PWA PR #11](https://github.com/scottjb814/kanji/pull/11) (merged and deployed):** Install manifest and red 字
  icons; explicit local app/data precache; readable KANJIDIC fallback when live
  sources fail; offline notice; user-triggered update/reload. Historical sources,
  images, online fonts and authenticated Kanjipedia requests remain online-only.
  Pages assembly hashes the complete output, including monthly dictionary data,
  into the service-worker version. Deterministic cache tests and a synthetic
  Chromium smoke test accompany the change. See the PWA PR for current CI results.
  No app-store packaging, synchronization, or full offline research is included.

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

