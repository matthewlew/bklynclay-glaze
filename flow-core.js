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
