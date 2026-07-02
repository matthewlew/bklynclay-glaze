# Design System Drift Audit — 2026-07-01

Comparing [design.md](../../design.md) (last touched 2026-06-29) against the live app ([index.html](../../index.html), last touched 2026-07-01) and the style-guide page ([design-system.html](../../design-system.html)).

## Summary

Two of the three guardrail violations design.md explicitly calls out (`#faf8f5` non-token, duplicate `.analytics-swatch-row`) are **already fixed** in index.html. The real drift is the opposite direction: the app has grown a second wave of tokens (tagged inline as `/* Design System Audit Additions */`, [index.html:19](../../index.html)) that design.md never documents, plus a handful of raw hex values and font sizes outside the documented scale.

## 1. Undocumented tokens (app ahead of doc)

[index.html:19-34](../../index.html) defines 15 tokens under a `Design System Audit Additions` comment that have no entry in design.md's token table:

| Token | Value | Doc status |
|---|---|---|
| `--white` | `#fff` | missing |
| `--gray-light` | `#fafafa` | missing (overlaps `.lchip` background documented as raw `#fafafa`) |
| `--gray-mid` | `#ddd` | missing |
| `--ink-hover` | `#2a2a2a` | design.md predicted this alias ("alias as `--ink-hover` if reused more than 2x") — now exists, doc not updated |
| `--danger` | `#c00` | same — design.md predicted this alias, doc not updated |
| `--danger-bg` | `#fff5f5` | missing |
| `--acc-rgb` | `184,69,16` | missing |
| `--score-hi-bg` / `--score-hi-text` | color-mix / `#1a5a30` | missing — new analytics scoring semantic colors |
| `--score-mid-bg` / `--score-mid-text` | color-mix / `#6a4010` | missing |
| `--warm` / `--cool` | `#c87030` / `#4870a0` | design.md lists these as **JS-only, do-not-tokenize** analytics colors — they've since been promoted to CSS custom properties, contradicting that rule |
| `--tone-dark` / `--tone-light` | `#181818` / `#d8d4cc` | same — also promoted from JS-only to CSS tokens |
| `--drag-bg` / `--drag-green-bg` / `--drag-green-outline` | `#fff8f5` / `#dff0e8` / `#5aaa7a` | missing — new drag-and-drop state colors, not in the States & Interactions table |

**Action:** Update design.md's Colors table and the "Analytics Colors (JS-rendered only)" section — `--warm`, `--cool`, `--tone-dark`, `--tone-light` are no longer JS-only and that guardrail line is now false.

## 2. Guardrails already resolved (doc is stale, not the app)

- Guardrail #7 (`--surf` ≠ `#faf8f5`) — no `#faf8f5` occurrences remain in index.html. Fixed.
- Guardrail #8 (duplicate `.analytics-swatch-row`) — only one definition exists now ([index.html:457](../../index.html)). Fixed.

**Action:** Delete both guardrail lines from design.md, or mark them resolved, so future readers don't chase phantom issues.

## 3. Remaining raw hex in component rules

Found outside `:root`, finish badges, and analytics color math (which design.md explicitly allows):

- `#e53935`, `#e05a78` — two colors with no token, no doc entry. Need identification of usage (grep shows line ~297 and ~665) and either a token or a documented exception.

## 4. Typography scale drift

design.md's scale tops out at 14px body / 10-13px labels. Live app additionally uses:

- `7px`, `8px`, `9px` — palette-detail mobile/compact variants ([index.html:664-777](../../index.html))
- `18px`, `22px` — icon-style buttons (`.pd-back`, `.pd-nav-btn`, `.mobile-shuffle-fab`)

These aren't necessarily wrong (icon glyphs and dense mobile chips are a reasonable exception) but they violate guardrail #2 ("No new font sizes outside the scale above") as written. **Action:** either extend the documented scale to include a "micro" tier (7-9px, mobile/dense contexts) and an "icon" tier (18-22px, icon buttons), or flag these as an intentional documented exception like the finish badges.

## 5. Border-radius drift

design.md documents `--r` (6px), pill (20-22px), modal (10px), small internal (3-4px). Live app also uses:

- `2px`, `1px`, `0` — not documented, likely fine-grained inner elements
- `999px` — a second "full pill" value alongside `20px`/`22px`, redundant naming
- `10px 10px 0 0` — directional radius, likely a sheet/drawer component design.md doesn't cover (mobile controls sheet, per recent commits)

**Action:** Add the mobile bottom-sheet component pattern to design.md (recent commits mention "tabbed mobile controls sheet (CapCut-style)"), which likely explains the `10px 10px 0 0` and `999px` additions.

## 6. Transition speed drift

design.md mandates `.12s` (UI), `.15s` (drag), `.2s` (toast) as the exhaustive set. Live app also uses `.1s`, `.18s`, `.4s`, plus `cubic-bezier` easing curves not mentioned at all, and `transition:none` for reduced-motion/instant states.

**Action:** design.md needs an easing-curve entry (used on nav sheet and shuffle interactions) and a documented `.1s`/`.18s`/`.4s` set, or these should be consolidated back to the canonical three speeds if the variance is unintentional.

## 7. Inline styles

Guardrail #6 allows `display:none` toggles in JS but forbids inline styles in HTML source. Found 9 inline `style="display:none"` attributes directly in index.html markup (lines 832, 838, 849, 872, 946, 1177, 1190, 1199, 1222) — these are static HTML, not JS-applied, which is a literal violation of the rule as written.

**Action:** Either move these to a CSS class (`.hidden{display:none}`) applied via class list, or relax guardrail #6 to explicitly permit static initial-hidden-state inline styles (arguably a reasonable exception since it prevents FOUC before JS runs).

## Recommended migration order

1. Quick doc-only fixes (no code change): remove resolved guardrails #7/#8, document the 15 new tokens, update the "analytics colors are JS-only" claim.
2. Identify and tokenize `#e53935` / `#e05a78`.
3. Decide font-size/border-radius/transition scale extensions vs. consolidation — likely doc extension since app-driven (mobile sheet, palette detail) rather than accidental drift.
4. Optional cleanup: `.hidden` utility class to replace static inline `display:none`, and collapse `999px` into the existing `20-22px` pill convention if functionally identical.
