// ── FLOW CORE ─────────────────────────────────────────────────────────────────
// Pure, DOM-free helpers for Flow mode: positioned gradient stops, axis
// geometry, and pointer math. No imports, no globals — unit-testable in Node.
// A stop is { hex, pos } (pos in 0..1, arrays sorted by pos); extra fields
// like `name` are preserved by every transform.

export const FLOW_MIN_STOPS = 2;
export const FLOW_MAX_STOPS = 6;

const clamp01 = v => Math.min(1, Math.max(0, v));

export function equalStops(hexes) {
  if (!hexes.length) return [];
  const n = hexes.length;
  if (n === 1) return [{ hex: hexes[0], pos: 0.5 }];
  return hexes.map((hex, i) => ({ hex, pos: i / (n - 1) }));
}

export function moveStop(stops, i, pos) {
  const next = stops.map(s => ({ ...s }));
  next[i].pos = clamp01(pos);
  const moved = next[i];
  next.sort((a, b) => a.pos - b.pos);
  return { stops: next, index: next.indexOf(moved) };
}

export function insertStop(stops, pos, fields) {
  if (stops.length >= FLOW_MAX_STOPS) return stops;
  const next = [...stops.map(s => ({ ...s })), { ...fields, pos: clamp01(pos) }];
  next.sort((a, b) => a.pos - b.pos);
  return next;
}

export function removeStop(stops, i) {
  if (stops.length <= FLOW_MIN_STOPS) return stops;
  return stops.filter((_, idx) => idx !== i);
}

export function replaceStopHex(stops, i, hex) {
  return stops.map((s, idx) => (idx === i ? { ...s, hex } : s));
}

export function midpoints(stops) {
  const out = [];
  for (let i = 0; i < stops.length - 1; i++) out.push((stops[i].pos + stops[i + 1].pos) / 2);
  return out;
}

// ── AXIS GEOMETRY ─────────────────────────────────────────────────────────────
// The radial/conic gradient center used by flowGradientCSS is (50%, 42%);
// turrell squares center at (50%, 50%) instead — see Task 7 plan notes.
const CX = 0.5, CY = 0.42, CY_TURRELL = 0.5;
// Vertical inset for the linear/stripes axis so handles clear the top pill and
// bottom hint; radial/turrell axis stops 70px short of the bottom edge.
const LINEAR_TOP = 120, LINEAR_BOT = 120, RADIAL_BOT = 70;

export function conicRingRadius(w, h) { return Math.min(w, h) * 0.33; }

export function axisPoint(mode, t, w, h) {
  if (mode === 'conic') {
    const r = conicRingRadius(w, h), a = t * 2 * Math.PI; // 0 = top, clockwise
    return { x: w * CX + r * Math.sin(a), y: h * CY - r * Math.cos(a) };
  }
  if (mode === 'turrell') {
    const y0 = h * CY_TURRELL;
    return { x: w * CX, y: y0 + t * Math.max(1, h - y0 - RADIAL_BOT) };
  }
  if (mode === 'radial') {
    const y0 = h * CY;
    return { x: w * CX, y: y0 + t * Math.max(1, h - y0 - RADIAL_BOT) };
  }
  return { x: w * CX, y: LINEAR_TOP + t * Math.max(1, h - LINEAR_TOP - LINEAR_BOT) };
}

export function axisPos(mode, x, y, w, h) {
  if (mode === 'conic') {
    const a = Math.atan2(x - w * CX, -(y - h * CY));
    return (a / (2 * Math.PI) + 1) % 1;
  }
  if (mode === 'turrell') {
    const y0 = h * CY_TURRELL;
    return Math.min(1, Math.max(0, (y - y0) / Math.max(1, h - y0 - RADIAL_BOT)));
  }
  if (mode === 'radial') {
    const y0 = h * CY;
    return Math.min(1, Math.max(0, (y - y0) / Math.max(1, h - y0 - RADIAL_BOT)));
  }
  return Math.min(1, Math.max(0, (y - LINEAR_TOP) / Math.max(1, h - LINEAR_TOP - LINEAR_BOT)));
}

export function offAxisDistance(mode, x, y, w, h) {
  if (mode === 'conic') {
    const dx = x - w * CX, dy = y - h * CY;
    return Math.abs(Math.hypot(dx, dy) - conicRingRadius(w, h));
  }
  return Math.abs(x - w * CX);
}

// DOM windowing: which feed indices stay mounted around idx.
export function windowRange(idx, total, span = 7) {
  return { start: Math.max(0, idx - span), end: Math.min(total - 1, idx + span) };
}

// ── GRADIENT CSS ──────────────────────────────────────────────────────────────
// Positioned-stop equivalents of view-rating.js's equal-stop cssForMode().
// Returns {background, backgroundImage?, backgroundSize?} style fields.
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const stopList = (stops) => stops.map(s => `${s.hex} ${pct(s.pos)}`).join(',');

function parseHex(h) {
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16)
  };
}

function rgbToOklab(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const lR = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  const lG = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  const lB = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  const l = 0.4122214708 * lR + 0.5363325363 * lG + 0.0514459929 * lB;
  const m = 0.2119034982 * lR + 0.6806995451 * lG + 0.1073969566 * lB;
  const s = 0.0883024619 * lR + 0.2817188376 * lG + 0.6299787005 * lB;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a_val = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_val = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return { L, a: a_val, b: b_val };
}

function oklabToRgb(L, a, b_val) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b_val;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b_val;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b_val;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699294 * s;
  const lG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lB = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const r = lR > 0.0031308 ? 1.055 * Math.pow(lR, 1/2.4) - 0.055 : 12.92 * lR;
  const g = lG > 0.0031308 ? 1.055 * Math.pow(lG, 1/2.4) - 0.055 : 12.92 * lG;
  const b = lB > 0.0031308 ? 1.055 * Math.pow(lB, 1/2.4) - 0.055 : 12.92 * lB;
  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255)))
  };
}

function lerpHex(h1, h2, alpha) {
  alpha = Math.max(0, Math.min(1, alpha));
  const easedAlpha = alpha * alpha * (3 - 2 * alpha);
  const c1 = parseHex(h1), c2 = parseHex(h2);
  const lab1 = rgbToOklab(c1.r, c1.g, c1.b);
  const lab2 = rgbToOklab(c2.r, c2.g, c2.b);
  const L = lab1.L + (lab2.L - lab1.L) * easedAlpha;
  const la = lab1.a + (lab2.a - lab1.a) * easedAlpha;
  const lb = lab1.b + (lab2.b - lab1.b) * easedAlpha;
  const rgb = oklabToRgb(L, la, lb);
  return '#' + [rgb.r, rgb.g, rgb.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function sampleFlowStops(stops, t) {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1].pos <= t) i++;
  const s0 = stops[i], s1 = stops[i + 1];
  const alpha = s1.pos > s0.pos ? Math.max(0, Math.min(1, (t - s0.pos) / (s1.pos - s0.pos))) : 0;
  return lerpHex(s0.hex, s1.hex, alpha);
}

export function wadaFlowSVG(stops, clayHex) {
  if (!stops || !stops.length) return '';
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
        const color = stops[brickCount % stops.length].hex;
        brickCount++;
        bricksHtml += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${color}" stroke="${clayHex}" stroke-width="1.2" />`;
      }
    } else {
      const cols = [{ x: 0, w: 25 }, { x: 25, w: 50 }, { x: 75, w: 25 }];
      for (let c = 0; c < 3; c++) {
        const { x, w } = cols[c];
        const color = stops[brickCount % stops.length].hex;
        brickCount++;
        bricksHtml += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${color}" stroke="${clayHex}" stroke-width="1.2" />`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bricksHtml}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function flavinFlowSVG(stops, clayHex) {
  if (!stops || !stops.length) return '';
  const W = 100, H = 100;
  const N = stops.length;
  let tubesHtml = '';
  const id = Math.random().toString(36).slice(2, 8);
  for (let i = 0; i < N; i++) {
    const color = stops[i].hex;
    const cx = (i + 0.5) * (W / N);
    tubesHtml += `<rect x="${cx - 5}" y="12" width="10" height="76" rx="1.5" ry="1.5" fill="${color}" opacity="0.32" filter="url(#flow-flavin-blur-wide-${id})" />`;
    tubesHtml += `<rect x="${cx - 2.5}" y="12" width="5" height="76" rx="1.2" ry="1.2" fill="${color}" opacity="0.75" filter="url(#flow-flavin-blur-med-${id})" />`;
    tubesHtml += `<rect x="${cx - 0.75}" y="12.5" width="1.5" height="75" rx="0.75" ry="0.75" fill="#ffffff" opacity="0.95" />`;
    tubesHtml += `<rect x="${cx - 2}" y="8" width="4" height="4" fill="#282828" stroke="#444" stroke-width="0.3" />`;
    tubesHtml += `<rect x="${cx - 2}" y="88" width="4" height="4" fill="#282828" stroke="#444" stroke-width="0.3" />`;
  }
  const defs = `
    <filter id="flow-flavin-blur-wide-${id}" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="5.5" />
    </filter>
    <filter id="flow-flavin-blur-med-${id}" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="1.8" />
    </filter>
  `;
  const wallBg = clayHex === '#8a4b38' || clayHex === '#8a4a35' ? '#221410' : '#161514';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="${wallBg}"/>${tubesHtml}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function mondrianFlowSVG(stops) {
  if (!stops || !stops.length) return '';
  const W = 100, H = 100;
  const N = stops.length;
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
    const color = stops[i % stops.length].hex;
    rectsHtml += `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${color}" stroke="#121212" stroke-width="2.0" />`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${rectsHtml}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function flowGradientCSS(mode, stops, clayHex) {
  if (!stops || !stops.length) return { background: clayHex || '#ccc' };
  if (stops.length === 1) return { background: stops[0].hex };
  
  if (mode === 'wada') {
    return {
      background: stops[0].hex,
      backgroundImage: wadaFlowSVG(stops, clayHex),
      backgroundSize: '100% 100%'
    };
  }
  if (mode === 'flavin') {
    const wallBg = clayHex === '#8a4b38' || clayHex === '#8a4a35' ? '#221410' : '#161514';
    return {
      background: wallBg,
      backgroundImage: flavinFlowSVG(stops, clayHex),
      backgroundSize: '100% 100%'
    };
  }
  if (mode === 'mondrian') {
    return {
      background: stops[0].hex,
      backgroundImage: mondrianFlowSVG(stops),
      backgroundSize: '100% 100%'
    };
  }

  if (mode === 'radial')
    return { background: `radial-gradient(circle at 50% 42%,${stopList(stops)})` };
  if (mode === 'conic') {
    const parts = stops.map(s => `${s.hex} ${pct(s.pos)}`);
    parts.push(`${stops[0].hex} 100%`);
    return { background: `conic-gradient(from 0deg at 50% 42%,${parts.join(',')})` };
  }
  if (mode === 'stripes') {
    const fwd = stops.map(s => `${s.hex} ${(s.pos * 50).toFixed(1)}%`);
    const rev = [...stops].reverse().map(s => `${s.hex} ${(50 + (1 - s.pos) * 50).toFixed(1)}%`);
    return { background: `linear-gradient(to bottom,${[...fwd, ...rev].join(',')})` };
  }
  if (mode === 'squeeze' || mode === 'bulge') {
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
      const color = sampleFlowStops(stops, (t1 + t2) / 2);
      const d = `M -50,${y1_start.toFixed(2)} Q 50,${y1_ctrl.toFixed(2)} 150,${y1_start.toFixed(2)} L 150,${y2_start.toFixed(2)} Q 50,${y2_ctrl.toFixed(2)} -50,${y2_start.toFixed(2)} Z`;
      paths.push(`<path d='${d}' fill='${color}' stroke='${color}' stroke-width='0.5'/>`);
    }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><filter id='blur'><feGaussianBlur stdDeviation='4'/></filter></defs><g filter='url(#blur)'>${paths.join('')}</g></svg>`;
    return {
      background: stops[0].hex,
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      backgroundSize: '100% 100%',
    };
  }
  if (mode === 'turrell') {
    const rects = stops.map(s => {
      const m = s.pos * 45;
      return `<rect x='${m.toFixed(2)}%' y='${m.toFixed(2)}%' width='${(100 - 2 * m).toFixed(2)}%' height='${(100 - 2 * m).toFixed(2)}%' fill='${s.hex}'/>`;
    }).join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>${rects}</svg>`;
    return {
      background: stops[0].hex,
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      backgroundSize: 'cover',
    };
  }
  return { background: `linear-gradient(to bottom,${stopList(stops)})` };
}
