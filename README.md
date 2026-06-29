# BklynClay Glaze Studio

A browser-based glaze palette design tool for ceramic artists at BklynClay. Explore, generate, and save glaze combinations — visualized as realistic SVG tile renderings on white or red clay bodies.

## What it does

- **Explore & Discover** — Browse generated glaze palettes (2–4 glazes each) rendered as layered SVG tiles with realistic finish textures (matte, shiny, crawl-dot, crawl-leather, crackle, textured)
- **Glaze library** — 40+ named glazes with hex colors, transparency values, and finish types
- **Clay body toggle** — Preview every palette on white or red clay; color math blends clay undertones through translucent layers
- **Feel levers** — Dial in palette mood with sliders (Earthy↔Vibrant, Subtle↔Bold, Matte↔Glassy) that weight glaze selection and generation
- **Artist filter** — Filter glazes by artist to surface combinations relevant to your practice
- **Glaze Pairings** — Dedicated view of curated two-glaze combinations with anchor-glaze filtering
- **Save & Projects** — Save palettes to named projects; each project stores its own lever state
- **Shuffle / Riff** — Generate a fresh batch or riff on an existing palette (swap one glaze at a time)
- **Import** — Paste glaze names (comma/newline/& separated) to batch-import palettes
- **Export** — Copy full session state as JSON for backup or transfer
- **Drag-to-reorder** — Rearrange glaze layers within a palette card via drag-and-drop
- **Image palette extraction** — Drop an image into the discover area to extract a color palette (experimental)
- **Analytics tab** — Usage stats: most-used glazes, finish-type distribution, palette size breakdown

## Architecture

Single self-contained HTML file (`bklyn_studio_v6_2.html`) — no build step, no dependencies, no server required. Open in any modern browser.

```
bklyn_studio_v6_2.html
├── <style>          — All CSS (CSS custom properties, responsive grid, SVG tile styles)
├── <body>           — App shell: topbar, left panel, main content area, right sidebar, modals
└── <script>
    ├── CONSTANTS    — GLAZES array, CLAY colors, LEVERS definitions, PRESETS
    ├── STATE        — palettes, likedMeta, projects, clayKey, leverState, activeContext
    ├── PARSER       — tokenize(), lookupGlaze(), parseBlocks() for import
    ├── COLOR MATH   — applyGlaze(), sampleAt(), glazeCSS() — clay blending and gradient stops
    ├── SVG          — tileInner(), tileSVG(), pairTileSVG(), texture patterns
    ├── GENERATION   — generatePalette(), genBatch(), scoreGlaze(), weightedPick()
    ├── UI           — renderGallery(), renderSidebar(), renderGlazes(), renderPairings()
    └── PERSISTENCE  — localStorage via save()/load()
```

All state is persisted to `localStorage` automatically.

## Data model

```js
// A saved palette
{ key, label, tag, glazes: [{ name, hex, fin, trans }], clayKey }

// A project
{ id, name, leverState: { earthy, bold, glassy } }

// A glaze
{ name, hex, fin, trans, artists }
```

## Contributing / AI assistance guidelines

This project is a single-file vanilla HTML/CSS/JS app. When making changes:

**Do**
- Keep everything in one file — no bundlers, no frameworks, no npm
- Use CSS custom properties (`--ink`, `--surf`, `--border`, etc.) for all colors
- Render new visual elements as inline SVG
- Persist new state fields through `save()`/`load()` and `localStorage`
- Follow the existing naming conventions: `render*()` for DOM updates, `mk*()` for element factories
- Test on both white and red clay (`clayKey = 'white' | 'red'`)

**Don't**
- Add external libraries or CDN imports
- Break the single-file constraint
- Use `innerHTML` for user-supplied strings (XSS risk) — use `textContent` or DOM methods
- Add a build step or package.json

**Key areas for AI contribution:**
- New finish texture patterns (SVG `<pattern>` elements in the `// ── SVG ──` section)
- Additional glaze entries in the `GLAZES` array
- New analytics charts in the Analytics tab
- Riff/generation algorithm improvements in `scoreGlaze()` and `generatePalette()`
- Mobile layout improvements (currently hidden below 700px)

## Running locally

No setup required. Just open the file:

```bash
open bklyn_studio_v6_2.html
# or drag it into any browser
```

For development with live reload:

```bash
npx serve .
# then open http://localhost:3000/bklyn_studio_v6_2.html
```

## Versioning convention

File is versioned in the filename (`v6_2` = version 6.2). When making significant changes, bump the minor version in the filename and update the `<title>` tag to match.
