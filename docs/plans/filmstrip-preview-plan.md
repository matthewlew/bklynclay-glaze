# Plan: Scrubbable Filmstrip Preview (Palette Detail View)

## Goal

In the palette detail view (`palette-detail.js`), add a horizontal filmstrip of thumbnails — Apple Photos style — so users can scroll/drag through palettes without leaving the detail view. Syncs with existing `pdNext()` / `pdPrev()` navigation.

## Background

- Detail view: `palette-detail.js`, overlay markup at `index.html:1172-1207`.
- Nav already exists: arrow keys/buttons call `pdNext()`/`pdPrev()`, counter at `#pdNavCounter` (`palette-detail.js:204`).
- No thumbnail/filmstrip UI exists anywhere in the codebase today.
- Stack: vanilla JS/ES modules, no framework, Vite bundler. All styling via CSS custom properties defined in `design.md`. No existing thumbnail generation/caching layer — palettes are rendered live via gradient canvas, not pre-rendered images.

## Scope

1. **Thumbnail source** — each filmstrip item needs a small static preview of a palette's gradient. Options: (a) render a tiny offscreen canvas per palette on demand and cache as data URL, (b) reuse whatever gallery-grid thumbnail rendering already exists (check `render.js`) and scale down.
2. **Filmstrip UI** — horizontal scrollable strip, one item per palette in the current gallery/filtered set, current item highlighted/centered, positioned below or beside `pd-canvas`.
3. **Interaction** — click a thumbnail to jump directly to that palette; drag/scroll to scrub; sync scroll position + highlight when `pdNext()`/`pdPrev()`/arrow keys are used.
4. **Keyboard** — arrow keys continue to work as today; filmstrip is a visual/pointer affordance, not a new keybinding.
5. **Responsive** — behavior on mobile (touch drag) vs desktop (scroll wheel/drag).
6. **Performance** — avoid re-rendering all thumbnails on every frame; cache rendered thumbnails, lazy-render offscreen ones.

## Open questions (need design decisions)

- Where exactly does the filmstrip sit — below the canvas, in the mode-bar area, or an edge-anchored overlay?
- How many thumbnails visible at once, and what's the sizing/aspect ratio?
- Does clicking a thumbnail navigate instantly or animate the transition?
- What's the empty/loading state for thumbnails whose gradient hasn't rendered yet?
- Behavior when the gallery has 100+ palettes — virtualize, or accept a long scroll?

## Non-goals

- No changes to the pin/keyboard-shortcut work (separate, already scoped).
- Not replacing the existing prev/next arrow buttons or counter.

---

## Design Specification (resolves open questions above)

### Placement & layout

- Filmstrip sits in a new `.pd-filmstrip` strip **directly below `pd-canvas`**, above the existing `pd-mode-bar`. It does not replace or overlap the prev/next arrows or `#pdNavCounter` — those stay exactly where they are, at the top of the overlay.
- Fixed height `56px` (thumbnail `40px` tall + `8px` vertical padding, matching the "Panel section padding: 14px" token halved for a denser strip — use `8px` explicitly, not a new token).
- Full width of `pd-overlay`, horizontally scrollable, no visible scrollbar (`scrollbar-width: none` / `::-webkit-scrollbar { display:none }`), scroll-snap-type: `x mandatory`.
- Background: `var(--surf)`, top border `1px solid var(--border)` to separate it from the canvas above (reuses existing border token, not a new value).

### Thumbnail sizing & shape

- Each thumbnail: `40px × 40px`, `border-radius: var(--r)` (6px, per design.md — not a new radius value).
- `4px` gap between thumbnails (within the 5–8px "gap between buttons" range already documented).
- Content: a mini rendering of that palette's gradient (reuse the same gradient-generation function already used for `pd-canvas`, rendered to an offscreen `<canvas>` at 40×40 and cached as a data URL keyed by palette id — do not build a second gradient algorithm).

### States

- **Current/active item:** `border: 1.5px solid var(--acc)` + `transform: scale(1.08)` (reuses `.card.liked` / pinned-state border pattern from design.md — accent border means "current," not "pinned," so this is a distinct but visually consistent use of `--acc`). Centered in the scroll viewport on navigation.
- **Hover (desktop only):** `border-color: var(--border2)`, per existing hover-border pattern. No hover effect on touch (avoid sticky-hover on mobile Safari).
- **Loading (thumbnail not yet rendered):** flat `var(--border)` fill, no spinner, no skeleton shimmer (shimmer isn't in the existing pattern library — keep it plain per the "subtraction default" principle). Swap to the rendered gradient once the offscreen canvas resolves; this should be near-instant (<50ms) since it reuses existing render logic, so a loading state is mostly theoretical but must not show a broken image.
- **Empty gallery (0 or 1 palette in the filtered set):** hide the filmstrip entirely rather than showing a single disabled thumbnail or empty rail — a filmstrip with nothing to scrub through isn't a feature, it's clutter.

### Interaction

- **Click a thumbnail:** jumps instantly to that palette (no animated transition — consistent with the instant nature of existing `pdNext()`/`pdPrev()`, which have no transition today; adding one only to the filmstrip path would be inconsistent).
- **Drag/scroll to scrub:** native horizontal scroll (`overflow-x: auto`) + scroll-snap; no custom drag-physics library. On scroll-snap settle (`scrollend` event, with a debounced `scroll` fallback for Safari), if the settled item differs from the current palette, treat it as a navigation (update `pd-canvas`, `#pdNavCounter`, call the same code path as `pdNext()`/`pdPrev()` rather than a separate jump function).
- **Sync on arrow-key/button nav:** when `pdNext()`/`pdPrev()` fire, scroll the filmstrip to bring the new current thumbnail into view (`scrollIntoView({ inline: 'center', behavior: 'smooth' })`), and move the active-border to it.
- No new keybindings introduced — arrow keys behave exactly as documented in the existing `_onKeyDown` handler (`palette-detail.js:283`).

### Responsive / touch

- Mobile: identical layout, thumbnails stay `40px` (meets iOS/Android minimum comfortable touch target when combined with `4px` gaps giving effective ~44px hit area — do not shrink below this on small screens).
- Momentum scroll native to the OS (`-webkit-overflow-scrolling: touch`), no custom touch handler — avoids fighting native scroll physics on iOS.

### Accessibility

- Filmstrip container: `role="listbox"`, each thumbnail `role="option"` with `aria-selected` reflecting current state, `aria-label` set to the palette's name/id.
- Focusable via keyboard (`tabindex="0"` on the current thumbnail, roving tabindex pattern) so keyboard-only users can Tab into the filmstrip and use arrow keys to move focus + Enter to select, independent of the existing global arrow-key nav (global arrows still work on `pd-overlay` focus; filmstrip-focused arrows move within the strip only — scope by checking `document.activeElement` the same way the existing global listeners already do).
- Thumbnails are `<img>`/canvas elements with `alt`/`aria-label` describing the palette, not bare `<div>`s with only visual meaning.

### Performance

- Cache rendered thumbnail data URLs in memory per session (keyed by palette id); do not re-render on every scroll frame.
- Only render thumbnails within/near the visible scroll range + a small buffer (e.g. `IntersectionObserver` on each thumbnail slot) if the palette set exceeds ~50 items; for smaller sets, render all upfront since generation is cheap (<50ms each per above).
- For galleries with 100+ palettes: accept a long native scroll (no virtualization) for v1 — virtualizing a native-scroll-snap strip adds real complexity for a use case (100+ palette galleries) not yet confirmed to be common. Flag as a fast-follow if it becomes a real bottleneck.

---

## GSTACK REVIEW REPORT

| Pass | Dimension | Before | After | Notes |
|---|---|---|---|---|
| 1 | Information Architecture | 3/10 | 8/10 | Placement fixed relative to existing `pd-canvas`/mode-bar; doesn't compete with nav counter |
| 2 | Interaction States | 2/10 | 8/10 | Current/hover/loading/empty all specified with token-based values |
| 3 | AI Slop Risk | n/a | pass | No card-grid/hero pattern here; thumbnail strip is a native UI convention (Photos, video editors), not generic SaaS |
| 4 | User Journey | 4/10 | 8/10 | Instant-jump on click matches existing instant nav; scroll-snap settle treated as real navigation, not a dead end |
| 5 | Visual Hierarchy / Specificity | 2/10 | 9/10 | Exact sizes, tokens, borders specified — no "clean modern" hand-waving |
| 6 | Accessibility | 0/10 | 7/10 | `listbox`/`option` roles, roving tabindex, alt text specified. 7 not 10: exact screen-reader announcement copy still needs a pass during implementation |
| 7 | Responsive / Mobile | 1/10 | 8/10 | Touch target sizing and native momentum scroll specified; no custom touch handler risk |

**Runs:** Codex/outside-voices skipped (declined at gate: not offered — visual mockup generation unavailable, no OpenAI key configured for gstack designer; proceeded text-only per fallback).

**Status:** issues found → resolved in-plan (see Design Specification section above).

**VERDICT:** Plan is implementation-ready. Biggest remaining risk is the `scrollend` event's inconsistent browser support (Safari lacks it in older versions) — implementer should confirm the debounced `scroll`-event fallback actually settles correctly on the target Safari version before relying on it.

**NO UNRESOLVED DECISIONS**
