// ── VIEW-TYPE RATING ─────────────────────────────────────────────────────────
// Pure helpers for the "Rate Views" card sort: generating equal-weight
// gradient CSS per view mode/reverse combo, and summarizing rating logs.
// No DOM, no global state.
import { GLAZES, CLAY } from './glazes-data.js';
import { applyGlaze, toHex } from './render.js';

export const VIEW_MODES = ['linear', 'radial', 'conic', 'stripes', 'turrell'];

function dispHex(name, ck) {
  const g = GLAZES.find(x => x.name === name);
  if (!g) return '#888';
  const c = applyGlaze(g, ck);
  return toHex(c.r, c.gr, c.b);
}

function equalStops(names, ck) {
  return names.map(n => dispHex(n, ck));
}

export function linearCSS(hexes) {
  if (hexes.length === 1) return hexes[0];
  return `linear-gradient(to bottom,${hexes.join(',')})`;
}

export function radialCSS(hexes) {
  if (hexes.length === 1) return hexes[0];
  return `radial-gradient(ellipse at 50% 50%,${hexes.join(',')})`;
}

export function conicCSS(hexes) {
  if (hexes.length === 1) return hexes[0];
  const n = hexes.length;
  const stops = hexes.map((h, i) => `${h} ${(i / n * 100).toFixed(1)}%`);
  stops.push(`${hexes[0]} 100%`);
  return `conic-gradient(from 0deg,${stops.join(',')})`;
}

export function stripesCSS(hexes) {
  if (hexes.length === 1) return hexes[0];
  const n = hexes.length;
  const fwd = hexes.map((h, i) => `${h} ${(i / n * 50).toFixed(1)}%`);
  const rev = [...hexes].reverse().map((h, i) => `${h} ${(50 + i / n * 50).toFixed(1)}%`);
  return `linear-gradient(to bottom,${[...fwd, ...rev].join(',')})`;
}

// Concentric-square (Turrell-style) thumbnail, rendered as an inline SVG
// data URI so it can be dropped straight into a background-image.
export function turrellSVGDataUri(hexes) {
  if (!hexes.length) return '';
  const n = hexes.length;
  const step = 45 / n;
  const rects = hexes.map((h, i) => {
    const m = (i * step).toFixed(2);
    const sz = (100 - 2 * parseFloat(m)).toFixed(2);
    return `<rect x='${m}%' y='${m}%' width='${sz}%' height='${sz}%' fill='${h}'/>`;
  }).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>${rects}</svg>`;
  // Fully encode the SVG so no literal quote/# characters can collide with the
  // outer CSS url("...") wrapper.
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Returns a plain style object ({background, backgroundImage?, backgroundSize?})
// for a given mode/reverse combo, using equal-weight stops of `names`.
export function cssForMode(mode, names, ck, reverse) {
  if (!names || !names.length) return { background: CLAY[ck] || '#ccc' };
  const arr = reverse ? [...names].reverse() : names;
  const hexes = equalStops(arr, ck);
  if (mode === 'radial') return { background: radialCSS(hexes) };
  if (mode === 'conic') return { background: conicCSS(hexes) };
  if (mode === 'stripes') return { background: stripesCSS(hexes) };
  if (mode === 'turrell') return { background: hexes[0], backgroundImage: turrellSVGDataUri(hexes), backgroundSize: 'cover' };
  return { background: linearCSS(hexes) };
}

// All 10 mode/reverse combos in a stable display order.
export function allCombos() {
  const combos = [];
  VIEW_MODES.forEach(mode => {
    combos.push({ mode, reverse: false });
    combos.push({ mode, reverse: true });
  });
  return combos;
}

export function comboKey(combo) {
  return `${combo.mode}:${combo.reverse ? 'rev' : 'fwd'}`;
}

// Aggregates a viewRatingLog (array of { key, order: [{mode,reverse}, ...] },
// rank 0 = best) into per-combo average rank across all rated palettes,
// sorted best (lowest avg rank) first.
export function summarizeViewRatings(log) {
  const sums = {}, counts = {};
  (log || []).forEach(entry => {
    (entry.order || []).forEach((combo, idx) => {
      const k = comboKey(combo);
      sums[k] = (sums[k] || 0) + idx;
      counts[k] = (counts[k] || 0) + 1;
    });
  });
  return Object.keys(sums)
    .map(k => ({ comboKey: k, avgRank: sums[k] / counts[k], count: counts[k] }))
    .sort((a, b) => a.avgRank - b.avgRank);
}
