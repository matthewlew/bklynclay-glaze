# BklynClay Glaze Studio — Design System

This document is the single source of truth for visual decisions. When building or extending any feature, read this first and follow it exactly. Do not introduce values not listed here.

---

## Stack

- **Pure HTML/CSS/JS** — no framework, no Tailwind
- All styling lives in `<style>` in `index.html`
- All tokens are CSS custom properties in `:root`

---

## Tokens

### Colors

| Token | Value | Usage |
|---|---|---|
| `--ink` | `#111` | Primary text, active states, filled buttons |
| `--ink2` | `#444` | Secondary text, default button labels |
| `--ink3` | `#888` | Muted text, labels, placeholders, icons |
| `--acc` | `#b84510` | Accent — liked/pinned states, progress, destructive hover |
| `--surf` | `#f5f3f0` | Page background, hover backgrounds, section backgrounds |
| `--card` | `#fff` | Card/panel backgrounds |
| `--border` | `#e4e4e0` | Default borders |
| `--border2` | `#ccc` | Stronger borders, hover border states |
| `--clay-w` | `#E2DDD6` | White clay body color (used in SVG rendering) |
| `--clay-r` | `#7A3828` | Red/Brooklyn clay body color (used in SVG rendering) |
| `--white` | `#fff` | Alias for white text/fill on dark or accent backgrounds |
| `--ink-hover` | `#2a2a2a` | Hover state for `.btn.primary` and dark FABs |
| `--danger` | `#c00` | Destructive hover text/border (`.btn.remove-subtle:hover`) |
| `--danger-bg` | `#fff5f5` | Destructive hover background |
| `--red` | `#e53935` | Destructive filled buttons (`.ds-btn.danger` in mobile sheet) — distinct from `--danger`, which is for hover-only states |
| `--pin-saved` | `#e05a78` | "Saved" pin badge text (`.pd-pin-badge.is-saved`) |
| `--pin-saved-border` | `rgba(224,90,120,.4)` | Border for saved pin badge |
| `--acc-rgb` | `184,69,16` | RGB channels of `--acc`, for `rgba()` composition where `color-mix` isn't used |
| `--gray-light` | `#fafafa` | Sidebar chip (`.lchip`) background |
| `--gray-mid` | `#ddd` | Misc light-mode secondary border |
| `--score-hi-bg` / `--score-hi-text` | `color-mix(in srgb,#2a7a40 12%,var(--surf))` / `#1a5a30` | Analytics score badge, high tier |
| `--score-mid-bg` / `--score-mid-text` | `color-mix(in srgb,#8a6020 12%,var(--surf))` / `#6a4010` | Analytics score badge, mid tier |
| `--drag-bg` | `#fff8f5` | Drag-over background (warm) |
| `--drag-green-bg` / `--drag-green-outline` | `#dff0e8` / `#5aaa7a` | Drag-over background/outline (valid-drop state) |

**Derived accent values (use these, do not hardcode):**
- `rgba(184,69,16,.12)` → accent glow/ring: `color-mix(in srgb, var(--acc) 12%, transparent)` — or use as `var(--acc)` at 12% opacity

### Semantic usage rules

- **Never use raw hex values in CSS rules.** Always use a token.
- `--surf` is for backgrounds that should feel slightly off-white (sections, hovers, inputs). Not for card surfaces.
- `--acc` is for "saved/liked" state (orange-red terracotta). Do not use it for primary CTAs — those use `--ink`.
- `--ink3` is the go-to for anything that should recede: timestamps, labels, helper text, counts.

---

## Typography

No custom typeface. Uses system font stack:

```css
--font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
```

| Role | Size | Weight | Usage |
|---|---|---|---|
| Nano | `7–9px` | `400–700` | Mobile/compact palette-detail chips, finish micro-labels, dense tile overlays |
| Section labels | `10px` | `700` + uppercase + `letter-spacing: .09em` | Panel headers, card section labels |
| Body / card labels | `12–13px` | `500–700` | Tab labels, card names, body copy |
| Supporting text | `11px` | `400–600` | Glaze names, chip labels, descriptions |
| Micro / metadata | `10px` | `400` | Counts, timestamps, finish badges |
| Base body | `14px` | `400` | Set on `body` |
| Icon glyph | `18–22px` | n/a | Icon-only buttons (`.pd-back`, `.pd-nav-btn`, `.mobile-shuffle-fab`) — not text, no weight/tracking rules apply |

**Rules:**
- Do not introduce new font sizes outside this scale.
- Do not add external typefaces.
- Uppercase labels always pair with `letter-spacing: .08-.10em` and `font-weight: 700`.
- Nano and icon-glyph tiers are exceptions for space-constrained mobile/icon contexts — don't use them for primary body copy.

---

## Spacing

| Use | Value |
|---|---|
| Card internal padding | `7–9px` |
| Panel section padding | `14px` |
| Sidebar scroll padding | `10px 8px` |
| Gap between buttons | `5–8px` |
| Section margin | `12–16px` |
| Topbar height | `50px` |
| Transition speed | `.12s` (UI) · `.15s` (drag) · `.2s` (toast) |

---

## Layout

```
┌─ topbar (50px, sticky) ────────────────────────────────┐
├─ left-panel (240px) ─┬─ main-content ─┬─ right-sidebar (248px) ─┤
│  Boards + Pinned     │  Gallery /      │  Clay · Glazes ·       │
│  + Pairings          │  Analytics      │  Presets · Levers      │
└──────────────────────┴─────────────────┴────────────────────────┘
```

- Left/right panels are sticky, `height: calc(100vh - 50px)`.
- Main scrolls independently.
- Both panels hide at `max-width: 700px`.

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--r` | `6px` | Default — all cards, buttons, inputs, dropdowns |
| Pill (chips, toasts) | `20px`, `22px`, or `999px` | Anchor chips, toast, multi-action bar, mobile sheet pills. `999px` is the "fully round regardless of height" form of the same pill pattern — prefer a fixed `20-22px` unless the element's height is dynamic. |
| Modal | `10px` | Modal only — intentionally larger |
| Bottom sheet | `10px 10px 0 0` | Mobile bottom-sheet top corners only |
| Small internal | `3–4px` | Glaze chips, swatches, dots |
| Micro internal | `1–2px` | Sheet drag handle, resize-bar ticks |

**Rule:** Use `var(--r)` for all standard interactive elements. Only deviate for pill shapes, modals, the bottom sheet, and micro internal marks, documented above.

---

## Components

### Buttons

```css
/* Default */
.btn → border: 1.5px solid var(--border); background: #fff; color: var(--ink2); border-radius: var(--r); padding: 6px 13px; font-size: 12px;

/* Primary (main CTA) */
.btn.primary → background: var(--ink); color: #fff; border-color: var(--ink);
.btn.primary:hover → background: #2a2a2a;

/* Active/pinned state */
.btn.pin-on → background: var(--acc); border-color: var(--acc); color: #fff;

/* Ghost */
.btn.ghost → background: none; border-color: transparent; color: var(--ink3);

/* Filter active */
.btn.filter-on → background: var(--ink); color: #fff;

/* Sizes */
.btn.sm → padding: 3px 9px; font-size: 11px;
.btn.xs → padding: 2px 7px; font-size: 10px;
```

**Rules:**
- One `.btn.primary` per view area maximum.
- Use `.btn.ghost` for icon-only or low-priority actions.
- Use `.btn.remove-subtle` for destructive secondary actions (small, with `#c00` hover).

### Cards

```css
.card → border-radius: var(--r); border: 1.5px solid var(--border); background: var(--card); overflow: hidden;
.card.liked → border-color: var(--acc);
.card.compact → reduced internal padding (5px vs 7px)
```

### Inputs / Selects

```css
border: 1.5px solid var(--border);
border-radius: var(--r);
padding: 5px 8px;
background: #fff;
font-family: var(--font);
font-size: 12px;
:focus → border-color: var(--ink);  /* default */
:focus → border-color: var(--acc);  /* inline textarea variant */
```

### Sidebar chips (`.lchip`)

```css
border: 1px solid var(--border);
background: #fafafa;
border-radius: 4px;
:hover → background: var(--surf); border-color: var(--border2);
```

### Topbar tabs (`.ttab`)

```css
color: var(--ink3); border-bottom: 2px solid transparent;
.ttab:hover → color: var(--ink);
.ttab.on → color: var(--ink); border-bottom-color: var(--ink);
```

### Toast

```css
background: var(--ink); color: #fff; border-radius: 22px; font-size: 13px;
```

### Modal

```css
background: #fff; border-radius: 10px; padding: 22px; box-shadow: 0 12px 40px rgba(0,0,0,.18);
```

---

## Finish Badges

| Finish | Background | Border | Text |
|---|---|---|---|
| `shiny` | `#eef2ff` | `#c4cdf0` | `#3344aa` |
| `matte` | `#f4f4f0` | `#d4d4cc` | `#555` |
| `crawl` | `#fff0ee` | `#e8c8c0` | `#883322` |
| `clear` | `#eef8ee` | `#b8d8b8` | `#336633` |
| `textured` | `#f8f4e8` | `#d8d0b8` | `#665533` |

These are hardcoded by design — they map to physical glaze finishes and should not be tokenized.

---

## States & Interactions

| State | Pattern |
|---|---|
| Hover (surface) | `background: var(--surf)` |
| Hover (border) | `border-color: var(--border2)` |
| Active / selected | `background: var(--ink); color: #fff` |
| Pinned / liked | `border-color: var(--acc)` or `background: var(--acc)` |
| Danger hover | `color: #c00; background: #fff5f5` |
| Drag over | `border-color: var(--acc); box-shadow: 0 0 0 2px rgba(184,69,16,.22)` |
| Disabled | Not yet used — use `color: var(--ink3); pointer-events: none` |

Default transitions: `transition: background .12s, color .12s, border-color .12s`

| Speed | Usage |
|---|---|
| `.12s` | Default — color/background/border state changes (the vast majority of transitions) |
| `.1s` | Small icon-button opacity/background (e.g. `.pd-block-del`) — allowed for tight-feedback micro-interactions |
| `.15s` | Drag states, pin badge color/border |
| `.18s` | Bottom-sheet nav height/position animation |
| `.2s` | Toast opacity |
| `.4s` | Progress bar width fill |

Easing: default is implicit ease. `cubic-bezier(.4,0,.2,1)` is used for the bottom-sheet slide-up transform — reserved for sheet/drawer open-close motion, not general UI state.

---

## Themes

The app ships four appearance themes, switchable via the **Appearance** control (right sidebar / mobile "View" sheet tab → `#themeToggle`). Each theme is a pure override of the semantic token layer — component CSS never branches on theme name, it only ever reads `var(--ink)`, `var(--surf)`, etc. This is what makes adding a theme cheap: define a `:root[data-theme="x"]` block that redeclares the semantic tokens, and every component restyles automatically.

| Theme | `data-theme` | Character |
|---|---|---|
| Light (default) | *(attribute absent)* | Base `:root` values — off-white, high contrast |
| Dark | `dark` | Inverted neutral — warm near-black surface, light text |
| Stoneware | `stoneware` | Light theme leaning into the white clay body's cream/warm-neutral palette |
| Brooklyn Red | `brooklyn` | Dark theme built around the Brooklyn Red clay body's brick/terracotta palette |

**Tokens that flip per theme:** `--ink`, `--ink2`, `--ink3`, `--border`, `--border2`, `--surf`, `--card`, `--acc`, `--ink-hover`, `--danger`, `--danger-bg`, `--acc-rgb`, `--white`, `--gray-light`, `--gray-mid`, `--score-hi-text`, `--score-mid-text`, `--drag-bg`, `--drag-green-bg`, `--drag-green-outline`.

**Tokens that never flip:** `--clay-w`, `--clay-r` (SVG glaze-body rendering), `--warm`, `--cool`, `--tone-dark`, `--tone-light` (analytics color math), `--font`, `--r`, `--panel`, `--side`, `--pin-saved`, `--pin-saved-border` (a fixed accent color, not part of the neutral scale). These are excluded on purpose — they represent physical/data properties, not app chrome, and changing them per-theme would make glaze colors lie about themselves.

**`--white` is semantic, not literal.** It means "the contrast color to place on top of an `--ink`-filled surface" (e.g. `.btn.primary` text). In light/stoneware, `--ink` is dark so `--white` is literally white. In dark/brooklyn, `--ink` becomes the *light* color (used for both text and fills, per the existing single-token pattern), so `--white` is redefined to a dark value there — same name, inverted meaning, correct contrast. Do not "fix" this by hardcoding `#fff` in a component; it will break in dark themes.

**Wiring:**
- `setTheme(name)` (in `index.html`'s inline module script) sets/removes `data-theme` on `<html>`, persists to `localStorage['bklyn_theme']`, and syncs `.theme-btn.on` state.
- A blocking inline `<script>` in `<head>` (before the stylesheet) applies the persisted theme synchronously to prevent a flash of the wrong theme on load.
- The Appearance control lives once in the DOM (right sidebar `.ps[data-sec="view"]`) and is physically relocated into the mobile bottom sheet by the existing `openSheet`/`setControlsSection` logic — do not duplicate the markup for mobile.

**Adding a 5th theme:** add one `:root[data-theme="x"]` block redeclaring the "flip" token list above, add one `.theme-btn` to `#themeToggle`, done. No component CSS or JS changes required unless the new theme needs a token that doesn't flip today.

---

## Analytics Colors

Used in both JS color math (SVG/canvas rendering) and CSS (badges/UI), backed by shared tokens:

| Token | Value | Purpose |
|---|---|---|
| `--warm` | `#c87030` | Warm temperature |
| `--cool` | `#4870a0` | Cool temperature (JS also uses `#4890c0` as a lighter variant in gradients — not tokenized, computed) |
| `--tone-dark` | `#181818` | Dark depth |
| `--tone-light` | `#d8d4cc` | Light depth |

These are CSS custom properties, not JS-only constants — reference `var(--warm)` etc. in CSS, and read the same computed values in JS via `getComputedStyle` or a mirrored JS constant. If JS and CSS drift on the hex value, the CSS token wins; update the JS constant to match.

---

## Guardrails

1. **No raw hex in CSS rules.** Use a token. If a color doesn't have a token, add one to `:root` first.
2. **No new font sizes** outside the scale above.
3. **No new typefaces.**
4. **No new border-radius values** outside those documented. Use `var(--r)` by default.
5. **No new transition speeds** outside the table above.
6. **No inline `style=""` in HTML source**, including static initial states. Use the `.hidden{display:none}` utility class for elements that start hidden and are toggled via `el.style.display` in JS — JS-set inline styles still override the class, so this is safe. One-off layout tweaks (e.g. a single `margin-top`) should become a class if reused, or stay inline only as a last resort.

---

## When Adding a New Feature

1. Check if an existing component pattern covers it (button variant, card, chip).
2. Use existing tokens only. If you need a new color, add a semantic token to `:root` — never inline a hex.
3. Match the typography scale exactly.
4. Use `var(--r)` for border-radius unless it's a pill or modal.
5. Keep transitions at `.12s`.
6. No inline styles in HTML markup.
