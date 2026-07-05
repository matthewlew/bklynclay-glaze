// ── FLOW CORE ─────────────────────────────────────────────────────────────────
// Pure, DOM-free helpers for Flow mode: positioned gradient stops, axis
// geometry, and pointer math. No imports, no globals — unit-testable in Node.
// A stop is { hex, pos } (pos in 0..1, arrays sorted by pos); extra fields
// like `name` are preserved by every transform.

export const FLOW_MIN_STOPS = 2;
export const FLOW_MAX_STOPS = 6;

const clamp01 = v => Math.min(1, Math.max(0, v));

export function equalStops(hexes) {
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
// The radial/conic/turrell gradient center used by flowGradientCSS is (50%, 42%).
const CX = 0.5, CY = 0.42;
// Vertical inset for the linear/stripes axis so handles clear the top pill and
// bottom hint; radial axis stops 70px short of the bottom edge.
const LINEAR_TOP = 120, LINEAR_BOT = 120, RADIAL_BOT = 70;

export function conicRingRadius(w, h) { return Math.min(w, h) * 0.33; }

export function axisPoint(mode, t, w, h) {
  if (mode === 'conic') {
    const r = conicRingRadius(w, h), a = t * 2 * Math.PI; // 0 = top, clockwise
    return { x: w * CX + r * Math.sin(a), y: h * CY - r * Math.cos(a) };
  }
  if (mode === 'radial' || mode === 'turrell') {
    const y0 = h * CY;
    return { x: w * CX, y: y0 + t * (h - y0 - RADIAL_BOT) };
  }
  return { x: w * CX, y: LINEAR_TOP + t * (h - LINEAR_TOP - LINEAR_BOT) };
}

export function axisPos(mode, x, y, w, h) {
  if (mode === 'conic') {
    const a = Math.atan2(x - w * CX, -(y - h * CY));
    return (a / (2 * Math.PI) + 1) % 1;
  }
  if (mode === 'radial' || mode === 'turrell') {
    const y0 = h * CY;
    return Math.min(1, Math.max(0, (y - y0) / (h - y0 - RADIAL_BOT)));
  }
  return Math.min(1, Math.max(0, (y - LINEAR_TOP) / (h - LINEAR_TOP - LINEAR_BOT)));
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
