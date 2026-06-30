# BklynClay Glaze Studio — Backlog

---

## Engineering Architecture (from /plan-eng-review · 2026-06-30)

### T1 — Split index.html into ES modules (P1)
Extract into `glazes-data.js`, `scoring.js`, `state.js`, `render.js`, `persistence.js` using vanilla ES modules (`<script type="module">`). No build tool required.
**Files:** `index.html` + 5 new `.js` modules
**Depends on:** Nothing (foundation task).

---

### T2 — Migrate localStorage to IndexedDB (P1)
Replace `bklyn_v6` localStorage with IndexedDB (50MB+). Add one-time migration that reads existing `bklyn_v6` data on first IndexedDB init. Show warning if IndexedDB unavailable (private/incognito).
**Files:** `persistence.js` (new module from T1)
**Depends on:** T1.

---

### T3 — Fix silent save failure (P1)
At `saveAll()` catch block (currently silent): show a toast notification + trigger `exportSession()` automatically so no work is lost.
**Files:** `index.html` line ~1772 (or `persistence.js` after T1)
**Depends on:** Nothing.

---

### T4 — Move GLAZES to glazes.json with embedded fallback (P2)
Extract `GLAZES` array to `glazes.json`, fetch at startup. If fetch fails, fall back to the embedded `GLAZES` constant in JS (already there as a constant).
**Files:** `glazes.json` (new), `index.html` / `glazes-data.js`
**Depends on:** T1 (ideally, but can be done standalone).

---

### T5 — Per-project score weight presets (P2)
Add `scorePreset` field to project schema: `Banding`, `Harmony`, `Contrast`, `MaterialMix`. Each carries different F1-F7 weight vectors. Wire into `scoreAesthetic()`.
**Files:** `scoring.js` (after T1) or `index.html` lines 852-919
**Depends on:** T1 (ideally).

---

### T6 — Wire pairwise rankings into glaze affinity map (P2)
Feed `rankSorted` results into a per-project glaze affinity map. Cap each glaze's multiplier at 2× and normalize after each update so accumulated rankings don't overwhelm the base algorithm.
**Files:** `scoring.js` + `state.js` (after T1) or `index.html` lines 2092-2172
**Depends on:** T1 (ideally).

---

### T7 — Split buildCard() into sub-functions (P2)
`buildCard()` is 160+ lines. Extract: `buildCardTile()`, `buildGlazeChips()`, `buildPinButton()`, `buildBoardDropdown()`, `buildDragHandlers()`.
**Files:** `render.js` (after T1) or `index.html` lines 1233-1399
**Depends on:** T1 (ideally).

---

### T8 — Targeted SVG refresh in renderGallery() (P2)
`renderGallery()` currently does full `innerHTML=''` on every update. Call `innerHTML=''` only on palette set changes; use existing `refreshStack()` for clay/lever changes.
**Files:** `render.js` (after T1) or `index.html` lines 1401-1406, 763
**Depends on:** T1 (ideally).

---

### T9 — Playwright E2E tests for critical paths (P2)
Add Playwright tests for: pin palette, save to board, export/import JSON, score behavior change on lever adjustment.
**Files:** `playwright.config.ts` (new), `tests/` dir (new)
**Depends on:** T2 (stable persistence before testing).

---

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
