# Flow Mode — Rapid Gradient Scroll Experience

**Date:** 2026-07-04
**Status:** Approved

## Summary

A full-screen, immersive "Flow ✦" mode launched from the Discover gallery. Vertical
scrolling flips rapidly between freshly generated gradient palettes (iPhone Photos /
SSENSE product-feed feel). Horizontal swiping switches the gradient view style
(linear, radial, conic, stripes, turrell). A single tap opens an edit mode showing
glaze names/colors with reorder and swap. Double-tap quick-saves; press-and-hold
opens an arc menu.

## Goals

- Make browsing generated palettes fast, tactile, and fun — flick through dozens in
  seconds, scroll back up to revisit any earlier one.
- Zero-friction saving via gestures (no buttons required).
- Reuse the existing generation engine, view-style renderers, and save/pin paths.

## Non-goals

- No changes to the existing gallery, detail view, or Rate Views tool.
- No new persistence format — saves go through the existing `likedMeta`/pin path.
- No per-card style memory (style is a global lens on the feed, not a per-card axis).

## Architecture

New module `flow-view.js`, following the existing module pattern (`palette-detail.js`,
`view-rating.js`). Markup for the overlay lives in `index.html`; styles in the main
`<style>` block using only design-system tokens.

### Overlay

- `#flowView`: fixed, full-viewport (`100dvh`) overlay above the app shell, hidden by
  default. Opened by a "Flow ✦" button in the Discover gallery (visible on both
  mobile and desktop). Closed via an ✕ button (top-right) or `Esc`. Opening/closing
  does not disturb gallery state.

### Vertical feed (palette navigation)

- `#flowFeed`: a vertical `scroll-snap-type: y mandatory` container; each child card
  is `100dvh` / `scroll-snap-align: start`. Native momentum scrolling provides the
  rapid-flash feel and scroll-back-up history.
- **Palette source:** each card is a fresh palette from `generatePalette(levers)`
  (occasionally `generateBandingPalette`, matching `genBatch()`'s 25% mix), respecting
  the current feel levers, artist filter, and clay body.
- **History:** an in-memory array `flowHistory` holds every palette generated this
  session (index = feed position). Scrolling up always restores earlier gradients.
- **Lazy generation:** when the user nears the end of rendered cards, generate and
  append ~5 more.
- **DOM windowing:** keep ~15 card nodes in the DOM (recycle far-offscreen cards),
  repositioning via spacer heights so native scroll offsets stay correct. `flowHistory`
  itself is unbounded for the session.
- **Card overlay UI:** glaze names (small, bottom-left) fade out while scroll velocity
  is high, fade back in at rest.

### Horizontal gesture (style switch)

- Not a scroll axis. A horizontal swipe (touch, threshold ~50px with horizontal
  dominance), horizontal wheel delta / `Shift+scroll`, or `←`/`→` keys cycles
  `flowStyle` through `VIEW_MODES` from `view-rating.js`:
  `linear → radial → conic → stripes → turrell` (wrapping).
- The style applies globally: the current card transitions in place (~200ms
  crossfade); other rendered cards update immediately. A pill flashes the style name
  center-screen (~800ms).
- **Rendering:** linear/radial/conic via `galleryGradientCSS()` (render.js);
  conic gets the existing `.conic-aperture` treatment; turrell reuses the detail
  view's turrell SVG rendering; stripes reuses the stripes pattern from the detail
  view. Shared logic is extracted/exported rather than duplicated.

### Tap → edit mode

- Single tap (after a ~250ms double-tap disambiguation window) freezes the feed
  (scroll locked) and slides up an edit panel over the current card.
- Panel shows one row/block per glaze: color swatch, glaze name, hex.
- **Reorder:** drag blocks to reorder layers; the background gradient updates live.
- **Replace:** tap a block to open a glaze picker (searchable list from the glaze
  library, honoring the artist filter); selecting swaps that glaze in place.
- Edits mutate the palette in `flowHistory`, so the edited version is what gets saved
  and what you see if you scroll back to it.
- **Exit:** a deliberate downward swipe/scroll on the panel, an ✕ button, or `Esc`
  dismisses edit mode back to the feed.

### Save gestures

- **Double-tap / double-click:** instant save of the current palette via the existing
  pin path (`likedMeta` + persistence), with a center pulse animation
  (heart/✦ scale-fade). Saving is idempotent — double-tapping an already-saved
  palette shows an "already saved" pulse variant, it does not unsave.
- **Press-and-hold (~450ms):** an arc menu fans out near the touch point (or cursor)
  with three items: *Save to project…*, *Pin*, *Riff*. Slide onto an item and
  release to select; release outside cancels. *Save to project…* opens the existing
  project picker; *Riff* replaces the current card's palette with a riffed variant
  in place.
- Hold is cancelled if the finger moves beyond a slop threshold before the timer
  fires (so scrolls never trigger it).
- **Desktop keys:** `S` save, `E` edit, `←`/`→` style, `Esc` close/back.

### Gesture disambiguation summary

| Gesture | Action |
|---|---|
| Vertical scroll/flick | Navigate palettes |
| Horizontal swipe / Shift+wheel / ←→ | Cycle view style |
| Single tap (250ms window) | Enter edit mode |
| Double tap | Quick save |
| Hold 450ms (under slop) | Arc menu |
| Swipe down in edit mode | Exit edit mode |
| Esc / ✕ | Exit edit mode, then Flow |

## Error handling

- Generation failure (e.g., over-constrained artist filter yields no valid palette):
  fall back to unconstrained generation for that card; never leave a blank card.
- If `flowHistory` grows very large, only DOM is windowed — memory per palette is
  tiny (a few glaze refs), so no cap is needed for a session.
- Overlay guards against double-open; body scroll is locked while Flow is open.

## Testing (Playwright)

- Open Flow from the gallery; close via ✕ and Esc.
- Scrolling down generates new cards; scrolling back up shows the same earlier
  palettes (history restore).
- Style cycling via keyboard updates card backgrounds and shows the pill; wraps
  around the mode list.
- Single tap opens edit mode; panel lists the card's glazes with names/hex;
  swipe-down/Esc exits.
- Reorder in edit mode changes gradient stop order; replace swaps a glaze.
- Double-tap saves: palette appears in `likedMeta` / saved section after closing.
- Hold-menu: appears after hold, release-on-item triggers action, release-outside
  cancels.

## Constraints

- Vanilla JS, no dependencies. All colors via design-system tokens (design.md).
- New code in `flow-view.js` + minimal markup in `index.html`; shared renderers
  exported from their current homes rather than copied.
- State persists through the existing `save()`/`load()` localStorage path.
- Works on mobile touch and desktop scroll wheel; tested on both white and red clay.
