// ── SCORING ───────────────────────────────────────────────────────────────────
// Pure functions — no DOM, no global state.

export function hd(a, b) {
  return Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
}

export function circularSpan(hues) {
  if (hues.length <= 1) return 0;
  const s = [...hues].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < s.length; i++) {
    const next = s[(i + 1) % s.length] + (i + 1 === s.length ? 360 : 0);
    maxGap = Math.max(maxGap, next - s[i]);
  }
  return 360 - maxGap;
}

export function cardTemperature(glazes) {
  const colorGlazes = glazes.filter(g => g.sat > 0.18);
  if (!colorGlazes.length) return null;
  const avgHue = colorGlazes.reduce((s, g) => s + g.hue, 0) / colorGlazes.length;
  return (avgHue < 70 || avgHue > 310) ? 'warm' : (avgHue > 150 && avgHue < 260) ? 'cool' : 'neutral';
}

export function cardDepth(glazes) {
  const lums = glazes.map(g => g.lum);
  const range = Math.max(...lums) - Math.min(...lums);
  if (range >= 0.45) return 3;
  if (range >= 0.22) return 2;
  return 1;
}

export function harmonyScore(hues) {
  if (hues.length < 2) return 0;
  let best = 0;
  const span = circularSpan(hues);
  best = Math.max(best, span < 60 ? 1 - span / 60 * 0.2 : Math.max(0, 1 - (span - 60) / 150));
  for (const h of hues) {
    const comp = (h + 180) % 360;
    const devs = hues.map(hh => Math.min(hd(hh, h), hd(hh, comp)) / 90);
    best = Math.max(best, 1 - devs.reduce((a, b) => a + b, 0) / devs.length);
  }
  for (const h of hues) {
    const h2 = (h + 120) % 360, h3 = (h + 240) % 360;
    const devs = hues.map(hh => Math.min(hd(hh, h), hd(hh, h2), hd(hh, h3)) / 60);
    best = Math.max(best, 1 - devs.reduce((a, b) => a + b, 0) / devs.length);
  }
  return Math.max(0, Math.min(1, best));
}

// F1-F7 weight presets, selectable per project. Each sums to 1.0.
// f1 contrast/saturation spread, f2 lightness range (banding/stripes), f3 lightness balance,
// f4 min pairwise distance, f5 hue harmony, f6 material variety, f7 achromatic penalty.
export const SCORE_PRESETS = {
  Balanced:    { label: 'Balanced',      desc: 'Equal weight across all qualities — good starting point for mixed collections.', weights: [0.18, 0.15, 0.17, 0.25, 0.07, 0.05, 0.13] },
  Banding:     { label: 'Banding',       desc: 'Favors light-to-dark transitions and stripe patterns where glazes repeat for layered flow effects.', weights: [0.10, 0.34, 0.12, 0.18, 0.06, 0.05, 0.15] },
  Harmony:     { label: 'Harmony',       desc: 'Rewards analogous, complementary, or triadic hue relationships — palettes that feel tonally cohesive.', weights: [0.08, 0.12, 0.16, 0.12, 0.34, 0.05, 0.13] },
  Contrast:    { label: 'Contrast',      desc: 'Prioritizes color pop and glaze separation — high saturation variance and visually distinct neighbors.', weights: [0.30, 0.10, 0.10, 0.34, 0.04, 0.04, 0.08] },
  MaterialMix: { label: 'Material Mix',  desc: 'Values finish variety — matte, shiny, transparent, and textured glazes together in the same palette.', weights: [0.12, 0.13, 0.15, 0.20, 0.06, 0.26, 0.08] },
};

export const DEFAULT_SCORE_WEIGHTS = SCORE_PRESETS.Balanced.weights;

// F1-F7 weighted aesthetic score (0-100). `weights` is an optional [f1..f7]
// array (see SCORE_PRESETS); defaults to the Balanced preset.
export function scoreAesthetic(glazes, weights) {
  if (!glazes || glazes.length < 2) return 0;
  const w = weights || DEFAULT_SCORE_WEIGHTS;
  const n = glazes.length;
  const lums = glazes.map(g => g.lum);
  const sats = glazes.map(g => g.sat);
  const uniqueGlazes = glazes.filter((g, i) => glazes.findIndex(x => x.name === g.name) === i);
  const isBanding = uniqueGlazes.length < n;

  const satMean = sats.reduce((a, b) => a + b, 0) / n;
  const satSig = Math.sqrt(sats.map(s => (s - satMean) ** 2).reduce((a, b) => a + b, 0) / n);
  const f1 = Math.min(1, satSig / 0.22);

  const lumR = Math.max(...lums) - Math.min(...lums);
  const f2base = lumR < 0.15 ? lumR / 0.15 * 0.4 : lumR > 0.85 ? Math.max(0.7, 1 - (lumR - 0.85) / 0.15) : 0.4 + Math.min(0.6, (lumR - 0.15) / 0.55);
  const f2 = isBanding ? Math.max(f2base, 0.55) : f2base;

  const lumMean = lums.reduce((a, b) => a + b, 0) / n;
  const f3 = Math.max(0, 1 - Math.abs(lumMean - 0.47) * (isBanding ? 1.5 : 3.0));

  const f4pool = uniqueGlazes.length >= 2 ? uniqueGlazes : glazes;
  let minDist = Infinity;
  for (let i = 0; i < f4pool.length; i++) for (let j = i + 1; j < f4pool.length; j++) {
    const d = hd(f4pool[i].hue, f4pool[j].hue) / 180 * 0.35
            + Math.abs(f4pool[i].lum - f4pool[j].lum) * 0.45
            + Math.abs(f4pool[i].sat - f4pool[j].sat) * 0.20;
    if (d < minDist) minDist = d;
  }
  const f4 = minDist >= 0.10 ? 1.0 : Math.pow(minDist / 0.10, 2);

  const f5 = harmonyScore(glazes.map(g => g.hue));

  const finTypes = new Set(glazes.map(g => g.fin === 'transparent' ? 'clear' : g.fin.startsWith('crawl') ? 'texture' : g.fin));
  const f6 = finTypes.size >= 2 ? 1 : 0.5;

  const achromaticCount = glazes.filter(g => g.sat < 0.10).length;
  const f7 = achromaticCount <= 1 ? 1.0 : Math.max(0.3, 1 - (achromaticCount - 1) * 0.35);

  return Math.round((f1 * w[0] + f2 * w[1] + f3 * w[2] + f4 * w[3] + f5 * w[4] + f6 * w[5] + f7 * w[6]) * 100);
}

// Lever-based glaze score (0 → not preferred, higher → more preferred given current levers).
export function scoreGlaze(g, lv) {
  const temp = lv.temp / 100, depth = lv.depth / 100, char = lv.char / 100;
  let s = 1.0;
  const isWarm = (g.hue >= 15 && g.hue <= 70 && g.sat > .2);
  const isCool  = (g.hue >= 170 && g.hue <= 260 && g.sat > .1);
  if (temp < 0.5) s += isWarm ? (0.5 - temp) * 5 : 0; else s += isCool ? (temp - 0.5) * 5 : 0;
  if (depth < 0.5) s += g.lum * (0.5 - depth) * 4; else s += (1 - g.lum) * (depth - 0.5) * 4;
  if (char < 0.5) s += (1 - g.sat) * (0.5 - char) * 4; else s += g.sat * (char - 0.5) * 4;
  return Math.max(0.05, s);
}

// Builds a per-glaze preference multiplier from a ranked list of pinned
// palettes (most-preferred first, as produced by the ranking flow). Glazes
// that skew toward the top of the ranking get a multiplier above 1, glazes
// that skew toward the bottom get one below 1. Capped at 2x/0.5x and
// normalized to a mean of 1 so it nudges generation rather than dominating it.
export function buildGlazeAffinity(rankedMeta) {
  const affinity = {};
  if (!rankedMeta || rankedMeta.length < 2) return affinity;
  const n = rankedMeta.length;
  const scoreSum = {}, count = {};
  rankedMeta.forEach((m, i) => {
    const rankWeight = 1 - i / (n - 1); // 1 at top, 0 at bottom
    (m.names || []).forEach(name => {
      scoreSum[name] = (scoreSum[name] || 0) + rankWeight;
      count[name] = (count[name] || 0) + 1;
    });
  });
  const names = Object.keys(scoreSum);
  if (!names.length) return affinity;
  const avgByName = {};
  names.forEach(name => { avgByName[name] = scoreSum[name] / count[name]; });
  const mean = names.reduce((a, name) => a + avgByName[name], 0) / names.length;
  names.forEach(name => {
    const raw = mean > 0 ? 1 + (avgByName[name] - mean) / mean : 1;
    affinity[name] = Math.max(0.5, Math.min(2, raw));
  });
  // Re-normalize so the mean multiplier is 1 (caps above can skew the mean up/down).
  const appliedMean = names.reduce((a, name) => a + affinity[name], 0) / names.length;
  if (appliedMean > 0) names.forEach(name => { affinity[name] = Math.max(0.5, Math.min(2, affinity[name] / appliedMean)); });
  return affinity;
}

export function pairingScore(a, b) {
  let s = 0;
  const hd_ = hd(a.hue, b.hue);
  if (hd_ >= 140 && hd_ <= 220) s += 3; else if (hd_ <= 40) s += 2; else if (hd_ >= 70 && hd_ <= 110) s += 1.5;
  const aShiny = a.fin === 'shiny' || a.fin === 'transparent';
  const bShiny = b.fin === 'shiny' || b.fin === 'transparent';
  if (aShiny !== bShiny) s += 1.5;
  const vd = Math.abs(a.lum - b.lum);
  if (vd > .35) s += 1.5; else if (vd > .20) s += 0.8;
  if (hd_ < 15 && vd < .15) s -= 2;
  return s;
}
