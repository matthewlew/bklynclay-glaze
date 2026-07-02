# BklynClay Glaze Studio — Backlog

---

## Engineering Architecture (from /plan-eng-review · 2026-06-30)

### T6 — Wire pairwise rankings into glaze affinity map (P2)
Feed `rankSorted` results into a per-project glaze affinity map. Cap each glaze's multiplier at 2× and normalize after each update so accumulated rankings don't overwhelm the base algorithm.
**Files:** `scoring.js` + `state.js` (after T1) or `index.html` lines 2092-2172
**Depends on:** T1 (ideally).

---

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

## Mobile UX (from session · 2026-07-01)

### M1 — Swipe-to-dismiss sheets with live finger tracking (P1) ✓
**Completed:** 2026-07-01 — Sheet follows finger live, springs back on low velocity/distance, dismisses on flick or dy>120px. Backdrop fades with drag. touchmove listener cleaned up on close.

### M2 — Horizontal swipe between Saved ↔ Discover sections (P1) ✓
**Completed:** 2026-07-01 — `initHorizontalSwipe()` on `#mainContent`; swipe left→Discover, right→Saved; 45° angle guard prevents triggering during vertical scroll.

### M3 — Haptic feedback on Android (P2) ✓
**Completed:** 2026-07-01 — `navigator.vibrate()` gated on `'vibrate' in navigator`: pin/save=15ms, shuffle=25ms, delete=[30,0,30].

### M4 — Replace `confirm()` / `prompt()` with mobile bottom sheets (P2) ✓
**Completed:** 2026-07-01 — `confirmSheet()` and `promptSheet()` reusable helpers in render.js; replaced both native dialog call sites in `showProjMenu()`.

### M5 — Pull-to-shuffle gesture (P3)
Pull down past 60px at the top of `#mainContent` to trigger shuffle, with spring-back animation and rotating shuffle icon. Only fires when already at scroll position 0.
**Files:** `render.js` — touch handlers on `#mainContent`; calls `shuffle()`
**Effort:** ~40 lines

---

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

### T9 — Playwright E2E tests for critical paths (P2)
**Completed:** 2026-07-01 (playwright.config.js + tests/smoke.spec.js — 7 smoke tests covering app load, clay toggle, tabs, scoring doc, board creation, scorePreset select, and keysMatch targeted refresh)
