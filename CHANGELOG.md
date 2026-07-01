# Changelog

## [1.1.0] — 2026-07-01

### Added
- **IndexedDB persistence** — app state now stored in `bklyn_glaze_db` (single-store, v1). Automatic one-time migration from `localStorage`. Falls back to localStorage on private browsing / incognito.
- **Per-project score weight presets** (T5) — `#scoreWeightSelect` dropdown per board with five named presets: Balanced, Banding, Harmony, Contrast, Material Mix. Each board remembers its preset independently.
- **Phase 2 Preference Learning skeleton** — `featureVector()` exported from `scoring.js`; `compPairs` and `learnedWeights` persisted to IndexedDB; calibration weight fitting infrastructure in `render.js` (`fitWeights`, `spearmanRho`, `openCalibrate`).
- **Scoring explainer doc** — `docs/scoring-explained.html` plain-language walkthrough of `scoreAesthetic()`, the seven features, default weights, and a guide for adding new taste dimensions (stripe/linear, gloss/matte, crawling).
- **Vite bundler** — replaces bare `<script type="module">` dev setup; `npm run dev` serves via Vite HMR on port 5173.
- **Playwright E2E tests** (T9) — `tests/smoke.spec.js` with 7 smoke tests covering: app load, clay toggle, tabs, scoring doc page, board creation, scorePreset select (T5), and keysMatch targeted refresh (T8).

### Changed
- **Targeted SVG + score refresh** (T8) — `renderGallery()` and `renderSavedSection()` compare palette keys before rendering; when keys match (clay/preset change, no shuffle), update only the SVG stacks and score badges in-place instead of rebuilding the entire DOM.
- **`switchContext()` lever-change guard** — `genBatch()` only runs when lever state actually changed when switching boards; prevents unnecessary palette regeneration.
- **Design system token audit** — extracted `--white`, `--score-hi-bg`, `--score-mid-bg`, `--drag-bg`, `--drag-green-bg`, `--warm`, `--cool`, `--tone-dark`, `--tone-light` from hardcoded hex literals in `index.html`.
- **Score tier constants** — replaced magic numbers `70`/`45` with `SCORE_HI`/`SCORE_MID` constants at module scope in `render.js`.
- **XSS fix** — project name in palette detail modal now inserted via `textContent`/DOM construction instead of `innerHTML` template literal.
- **Dead code removed** — `toggleBandView`, `setMobileTab`, `showMobileMoreMenu` exports removed (no callers); `makeProjTab` still exported for potential mobile/band-view future use.

### Fixed
- `scoreAesthetic()` was called twice per card in the keysMatch targeted-refresh path (once for badge, once for peek overlay); now computed once and reused.
- Variable `sc` scoping in keysMatch refresh: hoisted above badge/peek guard blocks to prevent `ReferenceError` if a card has a peek element but no badge.

[1.1.0]: https://github.com/matthewlew/bklynclay-glaze/releases/tag/v1.1.0
