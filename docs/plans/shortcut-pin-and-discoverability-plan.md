# Plan: Detail-View Pin Shortcut + Shortcut Discoverability

## Goal

1. Add `.` as a keyboard shortcut to pin/unpin the currently open palette from inside the detail view (`palette-detail.js`).
2. Improve discoverability of keyboard shortcuts beyond the existing `?` overlay: inline chip badges on detail-view buttons, and/or a contextual footer, and/or a one-time dismissible toast.

## Current state (verified in code)

- Gallery-card pinning goes through `togglePin(p, btn, card, compact)` at [render.js:1373-1395](../../render.js#L1373). It:
  - Takes the full palette object `p` (matched by `p.key`), a button element `btn`, a card element `card`, and a `compact` bool.
  - Toggles `p.key` in `state.likedKeys` (a `Set`) and adds/removes a matching entry in `state.likedMeta` (an array of `{key, label, feeling, tag, names, hexes, projectId}`).
  - Directly mutates `btn`/`card` classes and calls `saveAll(); renderSidebar(); updateCount(); showToast(...)`.
  - **This function is DOM-coupled** — it assumes a live button/card element to update, which the detail view does not have in the same shape.
- `palette-detail.js` tracks the current palette only by key: module-level `_key` ([palette-detail.js:7](../../palette-detail.js#L7)), with `_allKeys`/`_keyIdx` for nav ([palette-detail.js:11-12](../../palette-detail.js#L11)). It does not hold the full palette object `p`.
- `updatePinBadge()` ([palette-detail.js:236](../../palette-detail.js#L236)) is read-only — looks up `likedMeta.find(x => x.key === _key)` and updates `#pdPinBadge` text/class. There is no existing toggle path from the detail view.
- Keyboard handling in the detail view: `_onKeyDown` ([palette-detail.js:283-287](../../palette-detail.js#L283)) — arrows + Escape only, attached/detached at open/close.
- Shortcut help overlay: `#shortcutOverlay` ([index.html:971-984](../../index.html#L971)), a static `<table>`, toggled by global `?` handler. Existing row for pin: `<tr><td><span class="shortcut-key">S</span></td><td>Save / pin the focused palette</td></tr>` ([index.html:976](../../index.html#L976)).

## Architecture decision: don't duplicate toggle logic

`togglePin` is currently written as "toggle state AND update this specific DOM." Calling it as-is from the detail view means either:
- (a) faking a `btn`/`card` element, which is fragile and couples the detail view to gallery-card DOM structure, or
- (b) duplicating the `likedKeys`/`likedMeta` mutation logic in palette-detail.js, which violates DRY and creates two places that can drift.

**Recommendation: split `togglePin` into a pure state function + a DOM-update wrapper.**

```
togglePinState(key, meta)          // render.js — mutates state.likedKeys/likedMeta, calls saveAll()
  → returns { pinned: boolean }

togglePin(p, btn, card, compact)   // existing gallery-card caller — calls togglePinState, then updates btn/card, renderSidebar, updateCount, showToast
togglePinFromDetail(key)           // palette-detail.js caller — calls togglePinState, then updates #pdPinBadge, showToast
```

This is a ~15-line refactor (extract the Set/array mutation + `saveAll()` call into `togglePinState`, keep both callers thin) versus a duplicated ~20-line copy in a second file. Small diff, no behavior change for existing gallery pinning.

## Scope

### 1. `.` pin shortcut in detail view
- Extract `togglePinState(key, meta)` in render.js; export it.
- Add a case to `_onKeyDown` in palette-detail.js for `.`: look up the current palette's meta (needed for `likedMeta` entry — same data `updatePinBadge` already needs, so reuse that lookup path), call `togglePinState(_key, meta)`, then call `updatePinBadge()` and `showToast(...)`.
- Add a matching row to `#shortcutOverlay`'s table (index.html:971-984): `<tr><td><span class="shortcut-key">.</span></td><td>Pin / unpin the open palette</td></tr>`.
- No change to the existing `S` gallery shortcut or `togglePin`'s external behavior.

### 2. Shortcut discoverability (beyond `?` overlay)
Three independent, additive options — not mutually exclusive, but recommend shipping in this order of value/effort:
1. **Inline chip badge** next to `#pdPinBadge` showing the bound key (e.g. a small `.` chip), styled with existing tokens (`--border`, `--r`, `--ink3`) — no new component, reuses badge-adjacent placement. Lowest effort, always visible, no new state to manage.
2. **Shortcut-table row update** (already required by scope item 1 above) — zero extra cost once the shortcut exists.
3. **One-time dismissible toast** on first detail-view open ("Press . to pin, ← → to navigate") — needs a `localStorage` flag (e.g. `pd-shortcut-hint-seen`) to persist dismissal. Slightly more state to manage; skip unless the chip badge alone proves insufficient.

**Not recommended for v1:** a persistent contextual footer bar — redundant with the inline chip badge for a single shortcut, and adds a new persistent UI element for marginal benefit. Revisit only if more detail-view shortcuts are added later and a single chip badge no longer scales.

## Test coverage

- Unit/integration test (existing test setup — check `tests/` dir and `playwright.config.js`): pressing `.` in the detail view toggles pin state and `likedKeys`, matches toggling via the gallery card for the same palette (regression test proving the two code paths produce identical state).
- Test: pin badge (`#pdPinBadge`) and gallery card's `pin-on` class stay in sync after toggling from either surface.
- Test: `.` shortcut does nothing when focus is in a text input (consistent with existing `document.activeElement` guard pattern used by other global shortcuts).
- Test: shortcut overlay (`?`) shows the new `.` row.

## NOT in scope

- Contextual footer bar (deferred, see above).
- Any change to global gallery-level shortcuts (`S`, arrows, number keys).
- Distribution/build pipeline — not applicable, this is in-app UI.

---

## Review Findings

### Architecture
- **[Resolved]** `togglePin` DOM/state coupling — extract `togglePinState(key, meta)`, per decision above. Both call sites (`togglePin` in render.js, new detail-view handler) call the shared function; no duplicated Set/array mutation.
- **[Layer 1]** No new infra, no new dependency, no new concurrency pattern introduced — this is a same-file refactor plus an additive keybinding and an additive DOM chip. Boring by default, correctly scoped.
- One risk: `likedMeta` entries carry `{key, label, feeling, tag, names, hexes, projectId}` — the detail view's `.` handler needs to construct/find this same shape when pinning a *not-yet-pinned* palette (adding, not just removing). Confirm `palette-detail.js` has access to the full palette object (not just `_key`) somewhere already — if it only has the key, the plan needs a lookup against the master palette list, which should be named explicitly rather than left implicit. **Flag for implementer**, not blocking the plan.

### Code Quality
- DRY: the extraction avoids the two-copies problem. Good.
- Reuse: chip badge reuses `--border`/`--r`/`--ink3` tokens, no new component — consistent with the earlier design review's spec.
- Explicit over clever: `togglePinFromDetail(key)` as a named, thin wrapper (rather than inlining the toggle in `_onKeyDown`) keeps the keydown handler a dispatcher, not business logic — matches the existing pattern where `_onKeyDown` calls named functions (`pdNext()`, `pdPrev()`) rather than inlining behavior.

### Tests
- **Gap:** `tests/` currently has only `pwa-preview.spec.js` and `smoke.spec.js` — no existing coverage for keyboard shortcuts, pin state, or the detail view at all. This plan's test list (state-parity test between gallery/detail pin paths, activeElement guard, shortcut-overlay row) would be net-new test surface, not an extension of existing specs.
- Per completeness principle: since this is a small, cheap-to-test surface (a Set toggle + a DOM class), write the full set now rather than "happy path only" — a regression here (pin state silently drifting between gallery and detail views) would be a confusing, hard-to-repro bug for users, and the cost of full coverage here is minutes, not hours.

### Performance
- No performance concerns — Set/array mutation and a single DOM class toggle, no loops over large collections, no new render passes.

## Outside Voice
Skipped — scope is small and well-understood from direct code reading (verified via Explore agent against render.js/palette-detail.js/index.html); not enough architectural ambiguity to warrant a second-model pass. If you want a second opinion before implementing, say so and I'll run one.

---

## GSTACK REVIEW REPORT

| Section | Status | Key finding |
|---|---|---|
| Architecture | Resolved | Extract `togglePinState(key, meta)` — shared state mutation, thin DOM wrappers per caller |
| Code Quality | Clean | DRY, token reuse, explicit dispatcher pattern in `_onKeyDown` |
| Tests | Gap flagged | No existing shortcut/pin/detail-view test coverage — full new suite required, not optional |
| Performance | Clean | No concerns — trivial Set/DOM operations |

**Runs:** Outside voice (Codex/cross-model) skipped — scope too small/well-verified to warrant it (see above).

**Status:** issues found → resolved in-plan (architecture decision made via AskUserQuestion; test gap called out explicitly in Scope > Test coverage).

**VERDICT:** Plan is implementation-ready. The only open item for the implementer to confirm at code time: whether `palette-detail.js` currently has access to the full palette object (for constructing new `likedMeta` entries when pinning) or only the key — if only the key, add an explicit lookup rather than assuming one exists.

**NO UNRESOLVED DECISIONS**
