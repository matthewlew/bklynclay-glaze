// ── VIEW-TYPE RATING ─────────────────────────────────────────────────────────
// Pure helpers for the "Rate Views" card sort: generating equal-weight
// gradient CSS per view mode/reverse combo, and summarizing rating logs.
// No DOM, no global state.
import { GLAZES, CLAY } from './glazes-data.js';
import { applyGlaze, toHex, rgbToOklab, oklabToRgb } from './render.js';

export const VIEW_MODES = ['linear', 'radial', 'conic', 'stripes', 'turrell', 'squeeze', 'bulge', 'wada', 'flavin', 'mondrian'];

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

function parseHex(h) {
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16)
  };
}

function lerpColor(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  const easedT = t * t * (3 - 2 * t);
  const lab1 = rgbToOklab(c1.r, c1.g, c1.b);
  const lab2 = rgbToOklab(c2.r, c2.g, c2.b);
  const L = lab1.L + (lab2.L - lab1.L) * easedT;
  const la = lab1.a + (lab2.a - lab1.a) * easedT;
  const lb = lab1.b + (lab2.b - lab1.b) * easedT;
  const rgb = oklabToRgb(L, la, lb);
  return { r: rgb.r, g: rgb.g, b: rgb.b };
}

function toHexStr(c) {
  return '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function sampleHex(hexes, t) {
  t = Math.max(0, Math.min(1, t));
  const s = t * (hexes.length - 1);
  const i = Math.min(Math.floor(s), hexes.length - 2);
  const c1 = parseHex(hexes[i]);
  const c2 = parseHex(hexes[i + 1]);
  const mixed = lerpColor(c1, c2, s - i);
  return toHexStr(mixed);
}

export function squeezeBulgeSVGDataUri(hexes, mode) {
  if (!hexes || !hexes.length) return '';
  const c = mode === 'squeeze' ? 0.45 : -0.45;
  const N = 60;
  const paths = [];
  const tMin = -0.15, tMax = 1.15, tRange = tMax - tMin;
  for (let i = 0; i < N; i++) {
    const t1 = tMin + (i / N) * tRange;
    const t2 = tMin + ((i + 1) / N) * tRange;
    const y1_start = (t1 - 0.75 * c * (2 * t1 - 1)) * 100;
    const y1_ctrl = (t1 + 1.25 * c * (2 * t1 - 1)) * 100;
    const y2_start = (t2 - 0.75 * c * (2 * t2 - 1)) * 100;
    const y2_ctrl = (t2 + 1.25 * c * (2 * t2 - 1)) * 100;
    const colorStr = sampleHex(hexes, (t1 + t2) / 2);
    const d = `M -50,${y1_start.toFixed(2)} Q 50,${y1_ctrl.toFixed(2)} 150,${y1_start.toFixed(2)} L 150,${y2_start.toFixed(2)} Q 50,${y2_ctrl.toFixed(2)} -50,${y2_start.toFixed(2)} Z`;
    paths.push(`<path d='${d}' fill='${colorStr}' stroke='${colorStr}' stroke-width='0.5'/>`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><filter id='blur'><feGaussianBlur stdDeviation='4'/></filter></defs><g filter='url(#blur)'>${paths.join('')}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function squeezeCSS(hexes) {
  return squeezeBulgeSVGDataUri(hexes, 'squeeze');
}

export function bulgeCSS(hexes) {
  return squeezeBulgeSVGDataUri(hexes, 'bulge');
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
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function wadaSVGDataUri(hexes) {
  if (!hexes.length) return '';
  const W = 100, H = 100;
  const rowCount = 8;
  const rowH = H / rowCount;
  let bricksHtml = '';
  let brickCount = 0;
  for (let r = 0; r < rowCount; r++) {
    const y = r * rowH;
    const isOdd = r % 2 === 1;
    if (!isOdd) {
      const w = 50;
      for (let c = 0; c < 2; c++) {
        const x = c * w;
        const color = hexes[brickCount % hexes.length];
        brickCount++;
        bricksHtml += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${color}" stroke="#e6e3dd" stroke-width="1.2" />`;
      }
    } else {
      const cols = [{ x: 0, w: 25 }, { x: 25, w: 50 }, { x: 75, w: 25 }];
      for (let c = 0; c < 3; c++) {
        const { x, w } = cols[c];
        const color = hexes[brickCount % hexes.length];
        brickCount++;
        bricksHtml += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${color}" stroke="#e6e3dd" stroke-width="1.2" />`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bricksHtml}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function flavinSVGDataUri(hexes) {
  if (!hexes.length) return '';
  const W = 100, H = 100;
  const N = hexes.length;
  let tubesHtml = '';
  for (let i = 0; i < N; i++) {
    const color = hexes[i];
    const cx = (i + 0.5) * (W / N);
    tubesHtml += `<rect x="${cx - 5}" y="12" width="10" height="76" rx="1.5" ry="1.5" fill="${color}" opacity="0.35" filter="url(#f-blur-${i})" />`;
    tubesHtml += `<rect x="${cx - 0.75}" y="12.5" width="1.5" height="75" rx="0.75" ry="0.75" fill="#ffffff" opacity="0.95" />`;
  }
  let defs = hexes.map((color, i) => `
    <filter id="f-blur-${i}" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3.0" />
    </filter>
  `).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="#161514"/>${tubesHtml}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function mondrianSVGDataUri(hexes) {
  if (!hexes.length) return '';
  const W = 100, H = 100;
  const N = hexes.length;
  let layout = [];
  if (N === 2) {
    layout = [{ x: 0, y: 0, w: 100, h: 58 }, { x: 0, y: 58, w: 100, h: 42 }];
  } else if (N === 3) {
    layout = [{ x: 0, y: 0, w: 65, h: 65 }, { x: 65, y: 0, w: 35, h: 65 }, { x: 0, y: 65, w: 100, h: 35 }];
  } else if (N === 4) {
    layout = [{ x: 0, y: 0, w: 68, h: 68 }, { x: 68, y: 0, w: 32, h: 45 }, { x: 68, y: 45, w: 32, h: 55 }, { x: 0, y: 68, w: 68, h: 32 }];
  } else if (N === 5) {
    layout = [{ x: 0, y: 0, w: 45, h: 50 }, { x: 45, y: 0, w: 55, h: 32 }, { x: 45, y: 32, w: 55, h: 68 }, { x: 0, y: 50, w: 25, h: 50 }, { x: 25, y: 50, w: 20, h: 50 }];
  } else {
    layout = [{ x: 0, y: 0, w: 50, h: 38 }, { x: 50, y: 0, w: 50, h: 28 }, { x: 50, y: 28, w: 50, h: 42 }, { x: 50, y: 70, w: 50, h: 30 }, { x: 0, y: 38, w: 30, h: 62 }, { x: 30, y: 38, w: 20, h: 62 }];
  }
  let rectsHtml = '';
  for (let i = 0; i < layout.length; i++) {
    const rect = layout[i];
    const color = hexes[i % hexes.length];
    rectsHtml += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${color}" stroke="#121212" stroke-width="2.0" />`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${rectsHtml}</svg>`;
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
  if (mode === 'squeeze') return { background: hexes[0], backgroundImage: squeezeCSS(hexes), backgroundSize: '100% 100%' };
  if (mode === 'bulge') return { background: hexes[0], backgroundImage: bulgeCSS(hexes), backgroundSize: '100% 100%' };
  if (mode === 'wada') return { background: hexes[0], backgroundImage: wadaSVGDataUri(hexes), backgroundSize: '100% 100%' };
  if (mode === 'flavin') return { background: '#161514', backgroundImage: flavinSVGDataUri(hexes), backgroundSize: '100% 100%' };
  if (mode === 'mondrian') return { background: hexes[0], backgroundImage: mondrianSVGDataUri(hexes), backgroundSize: '100% 100%' };
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
