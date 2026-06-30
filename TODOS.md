# BklynClay Glaze Studio — Backlog

---

## Engineering Architecture (from /plan-eng-review · 2026-06-30)

### T6 — Wire pairwise rankings into glaze affinity map (P2)
Feed `rankSorted` results into a per-project glaze affinity map. Cap each glaze's multiplier at 2× and normalize after each update so accumulated rankings don't overwhelm the base algorithm.
**Files:** `scoring.js` + `state.js` (after T1) or `index.html` lines 2092-2172
**Depends on:** T1 (ideally).

---

### T9 — Playwright E2E tests for critical paths (P2)
Add Playwright tests for: pin palette, save to board, export/import JSON, score behavior change on lever adjustment.
**Files:** `playwright.config.ts` (new), `tests/` dir (new)
**Depends on:** T2 (stable persistence before testing).

---

## Completed

### T1 — Split index.html into ES modules (P1)
**Completed:** 2026-06-30 (Extract into `glazes-data.js`, `scoring.js`, `state.js`, `render.js`, `persistence.js` using vanilla ES modules)

### T2 — Migrate localStorage to IndexedDB (P1)
**Completed:** 2026-06-30 (Migrate `bklyn_v6` localStorage to IndexedDB with automatic one-time migration and private browsing restriction warning)

### T3 — Fix silent save failure (P1)
**Completed:** 2026-06-30 (Show toast + auto-export on localStorage quota exceeded or database write failure)

### T4 — Move GLAZES to glazes.json with embedded fallback (P2)
**Completed:** 2026-06-30 (Extract `GLAZES` array to `glazes.json`, fetch at startup using top-level await with embedded fallback)

### T5 — Per-project score weight presets (P2)
**Completed:** 2026-06-30 (Add `scorePreset` dropdown menu and hint block, connect to projects schema in relational database, and integrate selectable F1-F7 weight vectors in score calculations)

### T7 — Split buildCard() into sub-functions (P2)
**Completed:** 2026-06-30 (Extract `buildCardTile()`, `buildGlazeChips()`, `buildPinButton()`, `buildBoardDropdown()`, `buildDragHandlers()`)

### T8 — Targeted SVG refresh in renderGallery() (P2)
**Completed:** 2026-06-30 (Check list of palette keys to perform targeted element-level updates of SVGs and aesthetic score badges instead of full DOM rebuilding on clay/preset changes)


## Design + UX (from /plan-design-review · 2026-06-30)

## Completed

### T1 — Sticky Controls Toolbar in Gallery (P1)
**Completed:** 2026-06-30 (commit: f88931b — feat: gallery toolbar, section observer, shuffle animation)

### T2 — Science Row on Palette Cards (P1)
**Completed:** 2026-06-30 (commit: c3a2cd0 — feat: science row on palette cards (temperature + depth))

### T3 — Keyboard Shortcut System (P1)
**Completed:** 2026-06-30 (commit: 07fb3e9 — feat: keyboard shortcuts (Space/R=shuffle, S=save, ?=overlay, arrows=nav, 1-8=presets))

### T4 — Right-Click Context Menu on Palette Cards (P1)
**Completed:** 2026-06-30 (commit: 4f83bc8 — feat: right-click context menu on palette cards)

### T5 — Multi-Select + Bulk Action Bar (P2)
**Completed:** 2026-06-30 (commit: fc208f2 — feat: multi-select polish + mobile bottom sheet with swipe gestures)

### T6 — Mobile Bottom Sheet (P2)
**Completed:** 2026-06-30 (commit: fc208f2 — feat: multi-select polish + mobile bottom sheet with swipe gestures)

### T7 — Sticky Section Headers in Explore View (P2)
**Completed:** 2026-06-30 (commit: f88931b — feat: gallery toolbar, section observer, shuffle animation)

### T8 — Shuffle Micro-Animation (P3)
**Completed:** 2026-06-30 (commit: f88931b — feat: gallery toolbar, section observer, shuffle animation)
