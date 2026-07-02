# Plan: Right-Click Copy/Paste-to-Pair → Composition Canvas

## Goal

Right-click a palette card to copy it, then right-click another card to pair them into a multi-tile composition — like setting glaze test tiles side by side. Feeds the existing (currently unwired) composition modal.

## Critical finding: reuse, don't rebuild

`#compositionModal` already exists at [index.html:1034](../../index.html#L1034) with a full CSS scaffold from a same-day commit (`2f60367`):
- `.comp-overlay` / `.comp-modal` — full-screen dialog, `min(960px,96vw)` × `min(640px,90vh)`
- `.comp-header` with `.comp-title` and `.comp-col-count` (a row of `.comp-count-btn` — column-count picker, `.on` state already styled)
- `.comp-columns` → N `.comp-col` divs, each with a `.comp-col-label` (gradient-scrim text overlay, bottom-anchored)
- `.comp-divider` — draggable resize handle between columns (`cursor:col-resize`, `touch-action:none` — built for both mouse drag and touch)
- `.comp-footer` — right-aligned action row

**None of this has JS wiring.** No open/close function, no column population, no divider drag handler. The prototype's ad-hoc "composition canvas strip" (a flat row of fixed tiles) should be discarded in favor of wiring this existing modal — it's already designed for exactly this (multi-column, resizable, labeled) and building a second, competing composition UI would be pure duplication.

## Scope

### 1. Context menu: Copy / Paste-to-pair / Add-to-composition / Clear
Add a right-click handler to gallery cards (wherever cards are rendered in render.js — same place `togglePin`'s card is built), reusing the existing `.ctx-menu`/`.ctx-item` classes (already used elsewhere per index.html:523-526 conventions):
- **Copy palette** — stores the clicked palette's key in a module-level `_copiedPaletteKey` (single-slot, mirrors OS copy/paste semantics). Visually tags the source card (small tag, same treatment as `pd-pin-badge`'s saved state).
- **Paste as pair here** — disabled unless something is copied and the target isn't the copy source. Opens `#compositionModal` with 2 columns: copied palette + target palette.
- **Add to composition** — disabled if the modal isn't open, if this palette is already in the composition, or if at `MAX_TILES`. Appends a column.
- **Clear composition** — disabled if the composition is empty. Resets to 0 columns / closes modal.

### 2. Wire `#compositionModal`
- `openCompositionModal(paletteKeys: string[])` — builds `.comp-col` elements from the current palette list (reusing whatever gradient-render function the detail view/gallery cards already use — do not write a second gradient renderer), sets `.comp-col-count` buttons to reflect current count, wires `.comp-close`.
- `.comp-count-btn` click — if increasing count, prompts a card picker (or defaults to "add via right-click" only — **needs your input**, see Open Questions); if decreasing, removes the last column with a confirm-if-nonempty guard.
- `.comp-divider` drag — resize adjacent `.comp-col` flex-basis on pointermove, matching the existing pattern for any other draggable divider in the app (check if one already exists, e.g. sidebar resize, before writing new drag logic).
- `.comp-footer` — at minimum an "Export" or "Save as board" action (existing app has a board/pin concept — **decide whether a composition can be saved as a Board entry, or is session-only**, see Open Questions).

### 3. Data model
- Composition state: ordered array of palette keys (not full objects — consistent with how `palette-detail.js` already tracks `_key`/`_allKeys` rather than full palette objects).
- Not persisted across reloads for v1 (session-only) unless "save as board" is in scope — see Open Questions.

## Resolved decisions

1. **Column count control — pre-allocate empty slots.** Clicking a `.comp-count-btn` (e.g. "4") sets the modal to 4 columns, showing empty placeholder `.comp-col`s for any not yet filled. Right-click a gallery card → "Add to composition" fills the next empty slot in order. If all slots are full, "Add to composition" is disabled (matches the existing disabled-not-hidden convention from the prototype's ctx-menu). Changing the count down when slots are filled requires a confirm (dropping a filled slot is destructive within the session).
2. **Persistence — savable as a Board.** `.comp-footer` gets a "Save as board" action that creates a new board entry from the composition's ordered palette keys, reusing the existing board data model/infrastructure (no new persistence layer — check `persistence.js`/`state.js` for however boards are currently created and follow that exact path). Composition state itself (which slots are filled, in what order) stays session-only in the modal until the user explicitly saves.

## Still open (smaller, can resolve at implementation time)

3. **Multiple entry points**: should "Add to composition" also work from the detail view (not just gallery cards), given the earlier filmstrip-preview plan puts multiple palettes in view there too? Reasonable fast-follow if not needed for v1 — flag to implementer, not blocking.
4. **Max tiles**: the CSS supports arbitrary flex columns, but readability caps out somewhere — is 8 (used in the prototype) the right ceiling, or should it match the existing gallery's "4/8/12/16 tile divisions" config (per a recent commit title: "configurable tile divisions")? Recommend matching the existing 4/8/12/16 config for consistency rather than inventing a new number — flag to implementer to confirm against that commit's actual values.

## NOT in scope

- A new composition UI — explicitly rejected in favor of wiring the existing modal.
- Drag-and-drop reordering of composition tiles (v1 is copy/paste-to-add only; reordering is a reasonable fast-follow).
- Cross-session persistence unless Open Question 2 resolves toward "savable."
