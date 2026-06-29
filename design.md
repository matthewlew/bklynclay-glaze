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

**Derived accent values (use these, do not hardcode):**
- `rgba(184,69,16,.12)` → accent glow/ring: `color-mix(in srgb, var(--acc) 12%, transparent)` — or use as `var(--acc)` at 12% opacity
- Hover on primary button: `#2a2a2a` — alias as `--ink-hover` if reused more than 2x
- Danger color: `#c00` — alias as `--danger` if reused more than 2x

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
| Section labels | `10px` | `700` + uppercase + `letter-spacing: .09em` | Panel headers, card section labels |
| Body / card labels | `12–13px` | `500–700` | Tab labels, card names, body copy |
| Supporting text | `11px` | `400–600` | Glaze names, chip labels, descriptions |
| Micro / metadata | `10px` | `400` | Counts, timestamps, finish badges |
| Base body | `14px` | `400` | Set on `body` |

**Rules:**
- Do not introduce new font sizes outside this scale.
- Do not add external typefaces.
- Uppercase labels always pair with `letter-spacing: .08-.10em` and `font-weight: 700`.

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
| Pill (chips, toasts) | `20–22px` | Anchor chips, toast, multi-action bar |
| Modal | `10px` | Modal only — intentionally larger |
| Small internal | `3–4px` | Glaze chips, swatches, dots |

**Rule:** Use `var(--r)` for all standard interactive elements. Only deviate for pill shapes and modals, documented above.

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

All transitions: `transition: background .12s, color .12s, border-color .12s`

---

## Analytics Colors (JS-rendered only)

These are used only in JS for SVG/canvas rendering and computed color math — not in CSS:

| Purpose | Value |
|---|---|
| Warm temperature | `#c87030` |
| Cool temperature | `#4890c0` / `#4870a0` |
| Dark depth | `#181818` |
| Light depth | `#d8d4cc` |

Do not migrate these to CSS variables — they feed into color math algorithms.

---

## Guardrails

1. **No raw hex in CSS rules.** Use a token. If a color doesn't have a token, add one to `:root` first.
2. **No new font sizes** outside the scale above.
3. **No new typefaces.**
4. **No new border-radius values** outside those documented. Use `var(--r)` by default.
5. **All transitions at `.12s`** unless there's a documented reason (drag: `.15s`, toast: `.2s`).
6. **No inline styles in HTML.** Layout/state exceptions (display:none toggles) are acceptable in JS, but not in the HTML source.
7. **`--surf` ≠ `#faf8f5`.** The project section background uses `#faf8f5` which is a non-tokenized variant. Consolidate to `--surf` when touching those areas.
8. **Duplicate CSS rules must be resolved.** `.analytics-swatch-row` is currently defined twice — the second definition wins.

---

## When Adding a New Feature

1. Check if an existing component pattern covers it (button variant, card, chip).
2. Use existing tokens only. If you need a new color, add a semantic token to `:root` — never inline a hex.
3. Match the typography scale exactly.
4. Use `var(--r)` for border-radius unless it's a pill or modal.
5. Keep transitions at `.12s`.
6. No inline styles in HTML markup.
