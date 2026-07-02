# Changelog

## [Unreleased]

## [1.2.2] — 2026-07-02

### Changed
- **Mobile gallery cards always render as a single linear gradient** — the Tiles/Radial/Conic view modes and 4/8/12/16 tile-division picker are desktop-only now; mobile forces `linear` gradient rendering and hides those controls in the Controls sheet for a simpler, more consistent card look.
- **Aesthetic Score Weighting is now button selectors** — replaced the `<select>` dropdown with an `.achip` button grid matching the Style Presets buttons, on both desktop sidebar and mobile Controls sheet.
- **Mobile Controls tab order** — reordered to Adjust, View, Score, Style, Photo, Clay (previously Clay, View, Score, Style, Adjust, Photo); Adjust is now the default tab shown when the sheet opens.

## [1.2.1] — 2026-07-02

### Added
- **Detail-view pin shortcut** — press `.` inside the palette detail view to pin/unpin the open palette; shares state mutation with the gallery-card pin via new `togglePinState()` in `render.js`. Chip badge next to the pin status shows the bound key; new row added to the `?` shortcut overlay.
- **Per-project glaze affinity map** — `buildGlazeAffinity()` in `scoring.js` derives a per-glaze preference multiplier (capped 0.5x–2x, normalized to mean 1) from a project's completed palette ranking. Recomputed whenever ranking finishes, stored on `proj.glazeAffinity`, and applied as a weight multiplier in `generatePalette`/`generateBandingPalette` so shuffled palettes lean toward glazes the user ranked highly.
- **Mobile Projects screen** — dedicated full-screen board list on mobile with touch-based drag-reorder, replacing the sidebar project switcher on small viewports.
- **Board drag-reorder** — desktop topbar tabs and mobile Projects rows both support drag-to-reorder, persisted via `saveAll()`.

### Fixed
- **Palette detail pin button now clickable** — the pin/save control in the detail view topbar was a static `<span>` with no click handler; only the `.` keyboard shortcut worked. It's now a real `<button>` wired to `togglePinFromDetail()`, with a larger tap target for mobile.
- **Mobile gallery card clipping** — the mobile gallery grid forced every card row to a fixed height calibrated to fit exactly two rows on screen. Cards with fewer tiles left blank space at the bottom; cards with a full 4-tile stack got clipped by `overflow:hidden`, showing only 2 of 4 glaze tiles. Row height is now `auto` so cards size to their actual content.

### Removed
- **Dead card-footer builders** — `buildGlazeChips`, `buildPinButton`, and `buildBoardDropdown` in `render.js` were leftover from the pre-simplification card footer and were no longer called anywhere.

## [1.2.0] — 2026-07-02

### Added
- **Appearance themes** — Light, Dark, Stoneware, and Brooklyn Red themes via theme selector. Each theme remaps CSS tokens (`--bg`, `--surf`, `--text`, etc.) at the `:root` level and persists to localStorage.
- **Right-click copy/paste composition** — right-click any palette card to "Copy for composition", then right-click another to "Paste as pair here". Opens the composition modal pre-seeded with both palettes.
- **Composition modal: pre-allocated slots** — composition canvas now uses fixed slots (4/8/12/16, matching gallery tile divisions) with empty-state placeholders. "Add to composition" context menu item fills open slots; reducing column count warns before dropping filled palettes.
- **Composition drag dividers** — column width resizing uses `pointerdown`/`pointermove` instead of separate mouse + touch handlers; dragging is smoother and works on touch devices.
- **Detail view reverse** — pressing the active mode button again (Linear, Radial, Conic, Turrell, Stripes) reverses the stop order. Flip button always visible in the mode bar.

### Changed
- **Detail view blur/filter fixes** — Linear and Stripes modes now use `filter: none` explicitly to override the `.pd-gradient-bg` CSS default (`blur(60px)`). Stripes uses a mirrored `linear-gradient` (forward 0–50%, backward 50–100%) for a smooth seam, no `background-size` trick.
- **Conic aperture circle** — moved outside `#pdGradient` (sibling div `#pdConicAperture`) so it renders sharp regardless of the blur applied to the gradient element. Hidden via `classList.toggle('hidden')` to avoid `.hidden { display:none }` CSS conflict.
- **Turrell centering** — `right: 280px` applied to `#pdGradient` on desktop so SVG rects (percentage-based) center in the visible canvas area, not behind the stops panel.
- **Tile Divisions control** — hidden when gallery mode is not "Tiles" (irrelevant for Linear/Radial/Conic views).
- **Composition modal close** — Escape key and `closeCompositionModal()` wired through the global keyboard handler.

### Fixed
- Conic aperture not showing after mode switch — `apEl.style.display = ''` was overridden by `.hidden` CSS class; now uses `classList.toggle`.
- Radial gradient not centered on desktop — removed duplicate `right: 280px` from radial path (center already handled by `calc(50% - 140px)` inside `_radialCss`).

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
