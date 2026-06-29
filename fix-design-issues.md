# Fix Design System Issues in index.html

This is a self-contained task list for a new session. All issues are in `/Users/matthewlewair/Documents/bklynclay-glaze/index.html`. Read `design.md` in the same directory first — it is the source of truth.

---

## Context

The project is a single-file vanilla HTML/CSS/JS app (no framework). All CSS lives in a `<style>` block at the top of `index.html`. Tokens are CSS custom properties in `:root` (lines 9–18). The goal of these fixes is to make the codebase comply with `design.md`.

---

## Fix 1 — Add missing tokens to `:root` (line 9–18)

Add these four new tokens to the existing `:root` block:

```css
--ink-hover: #2a2a2a;
--danger: #c00;
--danger-bg: #fff5f5;
--surf-alt: #faf8f5;
--acc-rgb: 184,69,16;
```

---

## Fix 2 — CSS bug on `.glaze-action-bar` (line 166)

Current (broken):
```css
.glaze-action-bar{display:none;flex;gap:8px;padding:8px 12px;...}
```

`flex;` is a stale typo with no property name. Remove it:
```css
.glaze-action-bar{display:none;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);align-items:center;background:#fff;position:sticky;top:0;z-index:10;}
```

---

## Fix 3 — Remove duplicate `.analytics-swatch-row` rule (lines 251–252)

Lines 251–252 define `.analytics-swatch-row` identically to line 339. Delete lines 251–252 (the first occurrence):

```css
/* DELETE these two lines: */
.analytics-swatch-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);}
.analytics-swatch-row:last-child{border-bottom:none;}
```

Keep the definition at line 339 (it has `.analytics-pair-actions` right after it in context).

---

## Fix 4 — Replace hardcoded hex values with tokens

After adding the tokens in Fix 1, do a find-and-replace in the CSS `<style>` block only (not in JS):

| Find | Replace with |
|---|---|
| `background:#2a2a2a` | `background:var(--ink-hover)` |
| `color:#c00` | `color:var(--danger)` |
| `border-color:#c00` | `border-color:var(--danger)` |
| `background:#fff5f5` | `background:var(--danger-bg)` |
| `background:#faf8f5` | `background:var(--surf-alt)` |
| `background:#eeecea` | `background:var(--surf)` |
| `rgba(184,69,16,` | `rgba(var(--acc-rgb),` |

Affected lines (for reference): 33, 36, 89, 95, 141, 160, 298, 307, 335, 364, 272, 365, 366, 391.

**Do not change JS code** — color values in JS are used for SVG/canvas math and must stay as raw hex.

---

## Fix 5 — Inconsistent border-radius values

| Line | Selector | Current | Change to |
|---|---|---|---|
| 271 | `.rank-option` | `border-radius:8px` | `border-radius:var(--r)` |
| 314 | `.rate-card` | `border-radius:8px` | `border-radius:var(--r)` |
| 352 | `.multi-action-bar` | `border-radius:24px` | `border-radius:22px` |
| 181 | `.finish-badge` | `border-radius:10px` | `border-radius:20px` |

Leave these alone (documented exceptions): modal at `10px`, toast at `22px`, anchor chips at `20px`.

---

## Fix 6 — Move inline styles from HTML markup to CSS

### 6a — `<aside class="left-panel">` (around line 460)

Remove `style="display:flex;flex-direction:column;overflow:hidden;"` — these properties already exist in the `.left-panel` CSS rule.

### 6b — `#sbScroll` div (around line 466)

Remove `style="flex:1;overflow-y:auto;min-height:0;padding:10px 8px;"` and add to the `.sb-scroll` CSS rule:

```css
.sb-scroll{overflow-y:auto;padding:10px 8px;flex:1;min-height:0;}
```

### 6c — `#flash` div (around line 511)

Remove `style="margin:8px 10px 0;"` from the HTML and add to the `.flash` CSS rule:

```css
.flash{...(existing properties)...;margin:8px 10px 0;}
```

### 6d — Right sidebar `<div class="ps">` with `style="flex:1;"` (around line 540)

Add a modifier class in CSS:
```css
.ps.grow{flex:1;}
```
Replace `style="flex:1;"` with `class="ps grow"` on that element.

---

## Verification

After all fixes:

1. Open `index.html` in a browser — the app should look and behave identically to before.
2. Check that the Explore tab renders palettes, clay toggle works, and the shuffle button fires.
3. Check that `.glaze-action-bar` still appears correctly when a glaze is selected (the CSS bug fix must not break the `.visible` toggle).
4. Run a grep to confirm no raw hex remains in the CSS block (excluding finish badge colors and `#fff`/`#111` which are equivalent to token values):

```bash
grep -n "#[0-9a-fA-F]\{3,6\}" index.html | grep -v "//\|CLAY\|GLAZES\|hex:\|stop-color\|fill=\|stroke=\|background=\|rgba\|finish-badge\|#fff\|#111\|#fff0\|#eef\|#f4f\|#f8f"
```

---

## Commit message

```
Fix design system compliance issues in index.html

- Add missing CSS tokens (--ink-hover, --danger, --danger-bg, --surf-alt, --acc-rgb)
- Fix CSS bug: remove stray 'flex;' fragment from .glaze-action-bar
- Remove duplicate .analytics-swatch-row rule
- Replace hardcoded hex values with token references throughout CSS
- Normalize border-radius to var(--r) on .rank-option, .rate-card, .finish-badge
- Move inline styles from HTML markup into CSS rules
```
