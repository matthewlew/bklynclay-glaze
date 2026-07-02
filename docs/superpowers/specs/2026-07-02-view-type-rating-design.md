# Per-View-Type Palette Rating Tool

## Goal
Extend the existing pin-rating flow (Quick Rate / Full Rank in the analytics
Palette Ranking section) with a third mode, "Rate Views", that lets the user
card-sort each pinned palette's rendering across gradient view types
(linear, radial, conic, stripes, turrell) × normal/reversed. This produces:

1. A per-palette default view (`viewPrefs[key]`), used to render that
   palette in its preferred mode instead of the globally forced gallery mode.
2. An aggregate log (`viewRatingLog`) of full rank orders per palette, for
   future scoring-weight tuning (not wired into `scoreAesthetic` in this pass).

## UI flow
- New "Rate Views ✦" button next to "Full Rank" / "Quick Rate ★" in
  `renderRankInContainer` (render.js). Enters `rankMode='viewrating'`,
  queue = `[...likedMeta]`.
- Per palette: header with name + progress ("Palette N of M"), grid of 10
  preview cards (5 modes × normal/reversed), each rendering the palette's
  actual gradient CSS for that mode.
  - Linear/radial/conic reuse `galleryGradientCSS` (render.js:123).
  - Stripes/turrell get new CSS-generator helpers mirroring the logic in
    `palette-detail.js`'s `_gradMode` handling (`_radialCss`, stripe/turrell
    branches around lines 173–196).
  - Reversed variant reverses the glaze array before generating CSS.
- Click-to-rank: clicking a card stamps the next rank number (1, 2, 3…) in
  its corner. Clicking an already-ranked card un-ranks it and shifts later
  ranks down by one. "Done" enables once all 10 cards are ranked, or user
  can "Skip palette" to bail without saving.
- "Done" saves and advances to the next palette. Top-ranked card's
  `{mode, reverse}` becomes `viewPrefs[key]`; full order appended to
  `viewRatingLog`.
- After the last palette: results screen listing all 10 mode/reverse combos
  with their average rank across every rated palette so far (lower =
  better), similar in style to the existing `rankMode==='done'` results list.

## Data model
- `viewPrefs`: `{ [paletteKey]: { mode: 'linear'|'radial'|'conic'|'stripes'|'turrell', reverse: boolean } }`.
  Consulted when rendering a pinned palette's gallery tile / detail view as
  the initial mode, falling back to the current global `galleryViewMode`/
  `_gradMode` behavior when no entry exists.
- `viewRatingLog`: `Array<{ key: string, order: Array<{ mode, reverse }> }>`
  (rank 0 = best). Purely additive log, not consumed by scoring logic yet.
- Both persisted via `persistence.js` alongside existing `rankState`,
  `labelStore`, and pin state (same save/load functions, new keys).

## Explicit non-goals
- Not wiring `viewRatingLog` into `scoreAesthetic`/`SCORE_PRESETS` — this
  pass only collects the signal.
- Not changing the global `galleryViewMode` selector or forcing all
  palettes into one view — `viewPrefs` only affects rendering of palettes
  that have been rated.
