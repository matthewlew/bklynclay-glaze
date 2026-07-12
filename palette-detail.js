// ── PALETTE DETAIL PAGE ────────────────────────────────────────────────────────
import { GLAZES, CLAY } from './glazes-data.js';
import { saveAll } from './persistence.js';
import { glazeCSS, galleryGradientCSS, refreshStack, togglePinState, applyGlaze, toHex, showToast, sampleAt, sampleAtWeighted, hexRGB, rgbToOklab, oklabToRgb, easeT, copyToClipboard } from './render.js';

// ── Module state ───────────────────────────────────────────────────────────────
let _key        = null;
let _fallback   = null;
let _stops      = [];
let _drag       = null;
let _nid        = 0;
let _allKeys    = [];
let _keyIdx     = -1;
let _navigating = false;
let _swipeStartX = null, _swipeStartY = null;
let _gradMode   = 'linear';
let _noiseOn    = false;
let _gradReverse = false;
let _easingMode = 'smoother';

// Session-level cache so unpinned palettes also remember custom stop weights
// while the page is open. Survives close/reopen of the detail panel.
const _transientWeights = new Map();

const MIN_W = 6;

function mkStop(name, hex, w) { return {id: _nid++, name, hex, weight: w}; }
function isMobile() { return window.innerWidth <= 700; }

// Render the clay-adjusted color (matches gallery swatches) rather than the
// raw stored glaze hex, so the detail view never looks mismatched from the card.
function _dispHex(stop) {
  const g = GLAZES.find(x => x.name === stop.name);
  if (!g) return stop.hex;
  const ck = typeof clayKey !== 'undefined' ? clayKey : 'white';
  const c = applyGlaze(g, ck);
  return toHex(c.r, c.gr, c.b);
}

function normalize() {
  const t = _stops.reduce((a,s) => a + s.weight, 0) || 1;
  _stops.forEach(s => s.weight = (s.weight / t) * 100);
}

// Always equal weight on insert; resize handle is the only "custom" override
function insertStop(name, hex, at) {
  _stops.splice(at, 0, mkStop(name, hex, 1));
  const w = 100 / _stops.length;
  _stops.forEach(s => s.weight = w);
}

// ── Finish label ───────────────────────────────────────────────────────────────
function _finLabel(g) {
  if (!g?.fin) return '';
  const f = String(g.fin).toLowerCase();
  if (f === 'matte')           return 'Matte';
  if (f === 'shiny')           return 'Gloss';
  if (f === 'transparent')     return 'Clear';
  if (f === 'textured')        return 'Texture';
  if (f.startsWith('crawl'))   return 'Crawl';
  return g.fin;
}

// ── Similar-glaze navigation ───────────────────────────────────────────────────
function _hueDist(a, b) { const d = Math.abs((a||0)-(b||0)); return Math.min(d, 360-d); }

function _glazesByProximity(refGlaze) {
  return [...GLAZES].sort((a, b) => {
    const da = _hueDist(a.hue, refGlaze.hue)*1.0 + Math.abs(a.lum - refGlaze.lum)*60 + Math.abs(a.sat - refGlaze.sat)*30;
    const db = _hueDist(b.hue, refGlaze.hue)*1.0 + Math.abs(b.lum - refGlaze.lum)*60 + Math.abs(b.sat - refGlaze.sat)*30;
    return da - db;
  });
}

function swipeBlockGlaze(stop, dir) {
  const current = GLAZES.find(g => g.name === stop.name);
  if (!current) return;
  const sorted = _glazesByProximity(current);
  const idx = sorted.findIndex(g => g.name === stop.name);
  const next = sorted[(idx + (dir === 'next' ? 1 : -1) + sorted.length) % sorted.length];
  stop.name = next.name;
  stop.hex  = next.hex;
  // Patch DOM directly for instant feedback
  const el = document.querySelector(`[data-pid="${stop.id}"]`);
  if (el) {
    el.querySelector('.pd-block-fill').style.background = _dispHex(stop);
    el.querySelector('.pd-block-name').textContent = next.name;
    const finEl = el.querySelector('.pd-block-fin');
    if (finEl) finEl.textContent = _finLabel(next);
    el.querySelector('.pd-block-hex').textContent = next.hex;
  }
  renderGradBg(_stops);
  renderPickerHighlights();
  sync();
}

// ── Gradient CSS builders ──────────────────────────────────────────────────────
function _weights(arr) {
  const tot = arr.reduce((a,s) => a + s.weight, 0) || 1;
  return arr.map(s => s.weight / tot);
}

function lerpLinearOklab(c1, c2, alpha) {
  const lab1 = rgbToOklab(c1.r, c1.g, c1.b);
  const lab2 = rgbToOklab(c2.r, c2.g, c2.b);
  const L = lab1.L + (lab2.L - lab1.L) * alpha;
  const la = lab1.a + (lab2.a - lab1.a) * alpha;
  const lb = lab1.b + (lab2.b - lab1.b) * alpha;
  const rgb = oklabToRgb(L, la, lb);
  return { r: rgb.r, gr: rgb.g, b: rgb.b };
}

function _sampleAtWeighted(t, arr) {
  t = Math.max(0, Math.min(1, t));
  if (arr.length === 1) {
    const c = hexRGB(_dispHex(arr[0]));
    return { r: c.r, gr: c.g, b: c.b };
  }
  const ws = _weights(arr);
  let cum = 0;
  const breaks = [0];
  for (let i = 0; i < arr.length; i++) {
    cum += ws[i];
    breaks.push(Math.min(1, cum));
  }
  let seg = arr.length - 2;
  for (let i = 0; i < breaks.length - 2; i++) {
    if (t <= breaks[i+1]) {
      seg = i;
      break;
    }
  }
  const lo = breaks[seg], hi = breaks[seg+1];
  const alpha = hi > lo ? Math.max(0, Math.min(1, (t - lo) / (hi - lo))) : 0;
  
  const c1 = hexRGB(_dispHex(arr[seg]));
  const c2 = hexRGB(_dispHex(arr[seg+1]));
  return lerpLinearOklab(c1, c2, alpha);
}

function _linearCss(arr) {
  if (arr.length === 1) return _dispHex(arr[0]);
  const numStops = 17;
  const pts = [];
  for (let k = 0; k < numStops; k++) {
    const t = k / (numStops - 1);
    const easedT = easeT(t, _easingMode);
    const c = _sampleAtWeighted(easedT, arr);
    pts.push(`${toHex(c.r, c.gr, c.b)} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to bottom,${pts.join(',')})`;
}

function _radialCss(arr) {
  if (arr.length === 1) return _dispHex(arr[0]);
  const numStops = 17;
  const pts = [];
  for (let k = 0; k < numStops; k++) {
    const t = k / (numStops - 1);
    const easedT = easeT(t, _easingMode);
    const c = _sampleAtWeighted(easedT, arr);
    pts.push(`${toHex(c.r, c.gr, c.b)} ${(t * 100).toFixed(1)}%`);
  }
  const cx = isMobile() ? '50%' : 'calc(50% - 140px)';
  return `radial-gradient(ellipse at ${cx} 50%,${pts.join(',')})`;
}

function _conicCss(arr) {
  if (arr.length === 1) return _dispHex(arr[0]);
  // Match gallery style: hard-edge equal sectors, from 0deg, close loop with first color
  const ws = _weights(arr); let pct = 0;
  const pts = arr.map((s,i) => { const p = pct; pct += ws[i] * 100; return `${_dispHex(s)} ${p.toFixed(1)}%`; });
  pts.push(`${_dispHex(arr[0])} 100%`);
  const cx = isMobile() ? '50%' : 'calc(50% - 140px)';
  return `conic-gradient(from 0deg at ${cx} 50%,${pts.join(',')})`;
}

function _stripesCss(arr) {
  if (arr.length === 1) return _dispHex(arr[0]);
  const numStops = 17;
  const pts = [];
  for (let k = 0; k < numStops; k++) {
    const t = k / (numStops - 1);
    const easedT = easeT(t, _easingMode);
    const c = _sampleAtWeighted(easedT, arr);
    pts.push(`${toHex(c.r, c.gr, c.b)} ${(t * 50).toFixed(1)}%`);
  }
  for (let k = 0; k < numStops; k++) {
    const t = k / (numStops - 1);
    const easedT = easeT(t, _easingMode);
    const c = _sampleAtWeighted(1 - easedT, arr);
    pts.push(`${toHex(c.r, c.gr, c.b)} ${(50 + t * 50).toFixed(1)}%`);
  }
  return `linear-gradient(to bottom,${pts.join(',')})`;
}

function _squeezeBulgeSvg(arr, mode) {
  if (arr.length === 1) return _dispHex(arr[0]);
  const gs = arr.map(s => GLAZES.find(g => g.name === s.name)).filter(Boolean);
  const ws = _weights(arr);
  const ck = typeof clayKey !== 'undefined' ? clayKey : 'white';
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
    const color = sampleAtWeighted((t1 + t2) / 2, gs, ws, ck);
    const colorStr = `rgb(${Math.round(color.r)},${Math.round(color.gr)},${Math.round(color.b)})`;
    const d = `M -50,${y1_start.toFixed(2)} Q 50,${y1_ctrl.toFixed(2)} 150,${y1_start.toFixed(2)} L 150,${y2_start.toFixed(2)} Q 50,${y2_ctrl.toFixed(2)} -50,${y2_start.toFixed(2)} Z`;
    paths.push(`<path d='${d}' fill='${colorStr}' stroke='${colorStr}' stroke-width='0.5'/>`);
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><filter id='blur'><feGaussianBlur stdDeviation='4'/></filter></defs><g filter='url(#blur)'>${paths.join('')}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function _squeezeCss(arr) {
  return _squeezeBulgeSvg(arr, 'squeeze');
}

function _bulgeCss(arr) {
  return _squeezeBulgeSvg(arr, 'bulge');
}

function _turrellSVG(arr) {
  if (!arr.length) return '';
  const n = arr.length;
  const step = 45 / n;
  const rects = arr.map((s,i) => {
    const m = (i * step).toFixed(2);
    const sz = (100 - 2 * parseFloat(m)).toFixed(2);
    return `<rect x="${m}%" y="${m}%" width="${sz}%" height="${sz}%" fill="${_dispHex(s)}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block;position:absolute;inset:0">${rects.join('')}</svg>`;
}

// ── Gradient background renderer ───────────────────────────────────────────────
function renderGradBg(arr) {
  const el      = document.getElementById('pdGradient');
  const canvas  = document.getElementById('pdCanvas');
  const noiseEl = document.getElementById('pdNoiseOverlay');
  const apEl    = document.getElementById('pdConicAperture');
  if (!el) return;

  if (canvas && arr.length) canvas.style.backgroundColor = _dispHex(arr[0]);
  if (noiseEl) noiseEl.style.opacity = _noiseOn ? '1' : '0';

  // Reset all inline styles set by individual modes
  el.innerHTML = '';
  el.style.right = '';
  el.style.backgroundSize = '';
  el.style.backgroundRepeat = '';

  // Show/hide external aperture div (sibling of pdGradient, outside blur)
  if (apEl) {
    apEl.classList.toggle('hidden', _gradMode !== 'conic');
    if (_gradMode === 'conic') {
      apEl.style.background = CLAY[typeof clayKey !== 'undefined' ? clayKey : 'white'];
      apEl.style.left = isMobile() ? '50%' : 'calc(50% - 140px)';
    }
  }

  if (_gradMode === 'turrell') {
    const dispArr = _gradReverse ? [...arr].reverse() : arr;
    // Constrain element to visible canvas area (exclude 280px stops panel) so squares center correctly
    if (!isMobile()) el.style.right = '280px';
    el.style.filter    = 'blur(18px) saturate(0.9)';
    el.style.transform = 'scale(1.08)';
    el.style.background = dispArr.length ? _dispHex(dispArr[0]) : 'var(--surf)';
    el.innerHTML = _turrellSVG(dispArr);
    return;
  }

  if (_gradMode === 'wada' || _gradMode === 'flavin' || _gradMode === 'mondrian') {
    const dispArr = _gradReverse ? [...arr].reverse() : arr;
    const gs = dispArr.map(s => GLAZES.find(g => g.name === s.name)).filter(Boolean);
    const ws = dispArr.map(s => s.weight / 100);
    el.style.filter    = 'none';
    el.style.transform = 'none';
    el.style.background = galleryGradientCSS(gs, clayKey, _gradMode, ws);
    el.style.backgroundSize = '100% 100%';
    return;
  }

  if (_gradMode === 'conic') {
    const dispArr = _gradReverse ? [...arr].reverse() : arr;
    // Low blur to preserve the hard-edge wedge structure matching gallery style
    el.style.filter    = 'blur(3px) saturate(1.2)';
    el.style.transform = 'scale(1.02)';
    el.style.background = _conicCss(dispArr);
  } else if (_gradMode === 'radial') {
    const dispArr = _gradReverse ? [...arr].reverse() : arr;
    // _radialCss already centers at calc(50% - 140px) to account for the stops panel
    el.style.filter    = 'blur(20px) saturate(1.1)';
    el.style.transform = 'scale(1.04)';
    el.style.background = _radialCss(dispArr);
  } else if (_gradMode === 'stripes') {
    // Mirrored gradient: forward 0-50%, backward 50-100% — smooth seam at both ends
    const dispArr = _gradReverse ? [...arr].reverse() : arr;
    el.style.filter    = 'none';
    el.style.transform = 'none';
    el.style.background = _stripesCss(dispArr);
  } else if (_gradMode === 'squeeze' || _gradMode === 'bulge') {
    const dispArr = _gradReverse ? [...arr].reverse() : arr;
    el.style.filter    = 'none';
    el.style.transform = 'none';
    el.style.background = _gradMode === 'squeeze' ? _squeezeCss(dispArr) : _bulgeCss(dispArr);
  } else {
    // Linear — true gradient, no blur so transitions read accurately
    const dispArr = _gradReverse ? [...arr].reverse() : arr;
    el.style.filter    = 'none';
    el.style.transform = 'none';
    el.style.background = _linearCss(dispArr);
  }
}

// ── Block positions ────────────────────────────────────────────────────────────
function blockPositions(arr, size) {
  const tot = arr.reduce((a,s) => a + s.weight, 0) || 1;
  let pos = 0;
  return arr.map(s => { const sz=(s.weight/tot)*size; const r={start:pos,size:sz}; pos+=sz; return r; });
}

function tentativeOrder(srcIdx, insertBefore) {
  const arr = _stops.map(s => ({...s}));
  const [moved] = arr.splice(srcIdx, 1);
  const at = insertBefore > srcIdx ? insertBefore - 1 : insertBefore;
  arr.splice(at, 0, moved);
  return arr;
}

// ── Sync ───────────────────────────────────────────────────────────────────────
function sync() {
  // Compute normalised weights for the current stop array.
  const tot = _stops.reduce((a, s) => a + s.weight, 0) || 1;
  const ws  = _stops.map(s => s.weight / tot);

  // Always cache in the transient map — works for both pinned and unpinned palettes.
  _transientWeights.set(_key, ws);

  // If the palette is pinned, also persist names/hexes/weights to storage.
  const m = likedMeta.find(x => x.key === _key);
  if (m) {
    m.names   = _stops.map(s => s.name);
    m.hexes   = _stops.map(s => s.hex);
    m.weights = ws;
    saveAll();
  }

  // Update every sidebar chip gradient to reflect the new weights.
  const gs   = _stops.map(s => GLAZES.find(g => g.name === s.name)).filter(Boolean);
  const mode = typeof galleryViewMode !== 'undefined' ? galleryViewMode : null;
  if (gs.length) {
    const chipCss = galleryGradientCSS(gs, clayKey, mode, ws);
    document.querySelectorAll(`.lchip[data-key="${_key}"]`).forEach(chip => {
      const strip = chip.querySelector('.lchip-strip');
      if (chipCss && strip) strip.style.background = chipCss;
      let ap = chip.querySelector('.lchip-aperture');
      if (mode === 'conic') {
        if (!ap && strip) { ap = document.createElement('div'); ap.className = 'lchip-aperture'; ap.style.background = CLAY[clayKey]; strip.appendChild(ap); }
      } else if (ap) { ap.remove(); }
      if (m) chip.title = `${(chip.title.split('\n')[0]||'')}\n${m.names.join(', ')}`;
    });

    // Also update the gallery card's visual in the Discover grid in real time.
    if (mode) {
      const card = document.querySelector(`.card[data-key="${_key}"]`);
      if (card) {
        const colEl = card.querySelector('.tile-col');
        if (colEl) {
          const isCompact = card.classList.contains('compact');
          refreshStack(colEl, gs, clayKey, isCompact ? 44 : null);
        }
      }
    }
  }
}


// ── Nav counter ────────────────────────────────────────────────────────────────
function updateNav() {
  const counter = document.getElementById('pdNavCounter');
  const prev    = document.getElementById('pdPrevBtn');
  const next    = document.getElementById('pdNextBtn');
  const multi   = _allKeys.length > 1;
  if (counter) counter.textContent = multi ? `${_keyIdx + 1} / ${_allKeys.length}` : '';
  if (prev) prev.style.visibility = multi ? '' : 'hidden';
  if (next) next.style.visibility = multi ? '' : 'hidden';
}

function updateModeBar() {
  document.querySelectorAll('.pd-mode-btn[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === _gradMode);
  });
  const noiseBtn = document.getElementById('pdNoiseBtn');
  if (noiseBtn) noiseBtn.classList.toggle('active', _noiseOn);
  const flipBtn = document.getElementById('pdFlipBtn');
  if (flipBtn) {
    flipBtn.style.display = '';
    flipBtn.classList.toggle('active', _gradReverse);
  }
}

function updatePinBadge() {
  const badge = document.getElementById('pdPinBadge');
  if (!badge) return;
  const m = likedMeta.find(x => x.key === _key);
  badge.textContent = m ? '♥ Saved' : '○ Unsaved';
  badge.classList.toggle('is-saved', !!m);
}

// ── Pin toggle (shared state mutation, detail-view DOM update) ────────────────
export function togglePinFromDetail() {
  if (!_key) return;
  const m = likedMeta.find(x => x.key === _key);
  const p = m
    ? { key: _key, label: m.label, tag: m.tag, glazes: (m.names || []).map((name, i) => ({ name, hex: m.hexes[i] })) }
    : { key: _key, label: (_fallback && _fallback.label) || 'Palette', tag: _fallback && _fallback.tag, glazes: (_fallback && _fallback.glazes) || [] };
  const { pinned } = togglePinState(p);
  updatePinBadge();
  showToast(pinned ? 'Pinned' : 'Unpinned');
}

// ── Load data ──────────────────────────────────────────────────────────────────
// `fallback` is the in-memory palette object (p.glazes/p.label) used when the
// palette hasn't been pinned yet, so likedMeta has no entry for its key.
function _loadKeyData(key, fallback) {
  _key = key;
  _fallback = fallback || null;
  const m = likedMeta.find(x => x.key === key);
  _stops = [];
  const names = m ? (m.names || []) : (fallback?.glazes || []).map(g => g.name);
  const hexes = m ? (m.hexes || []) : (fallback?.glazes || []).map(g => g.hex);
  if (!names.length) return;
  // Restore weights: likedMeta (survives reload) > transient map (session) > equal fallback.
  const savedWeights = m?.weights || _transientWeights.get(key);
  const defaultW = 100 / names.length;
  names.forEach((name, i) => {
    const hex = hexes[i] || (GLAZES.find(g => g.name === name)?.hex) || '#888';
    const w = savedWeights ? savedWeights[i] * 100 : defaultW;
    _stops.push(mkStop(name, hex, w));
  });
  const nameVal = (typeof labelStore !== 'undefined' ? labelStore[key] : null) || m?.label || fallback?.label || 'Palette';
  const title = document.getElementById('pdTitle');
  if (title) title.value = nameVal;
  const gradTitle = document.getElementById('pdGradientTitle');
  if (gradTitle) gradTitle.value = nameVal;
  renderGradBg(_stops);
}

// ── Carousel navigation (instant) ─────────────────────────────────────────────
function _navigate(dir) {
  if (_navigating || _allKeys.length < 2) return;
  _navigating = true;
  if (dir === 'next') _keyIdx = (_keyIdx + 1) % _allKeys.length;
  else                _keyIdx = (_keyIdx - 1 + _allKeys.length) % _allKeys.length;
  _nid = 0; _drag = null;
  const container = document.getElementById('pdStopsContainer');
  if (container) container.innerHTML = '';
  _loadKeyData(_allKeys[_keyIdx]);
  updateNav();
  updatePinBadge();
  buildPicker();
  requestAnimationFrame(() => render());
  _navigating = false;
}

export function pdNext() { _navigate('next'); }
export function pdPrev() { _navigate('prev'); }

export function setGradMode(mode) {
  if (mode === _gradMode) {
    // Re-clicking the active mode toggles the color order
    _gradReverse = !_gradReverse;
  } else {
    _gradMode = mode;
    _gradReverse = false;
  }
  updateModeBar();
  renderGradBg(_stops);
}

export function pdToggleReverse() {
  _gradReverse = !_gradReverse;
  updateModeBar();
  render();
}

export function pdToggleNoise() {
  _noiseOn = !_noiseOn;
  updateModeBar();
  const noiseEl = document.getElementById('pdNoiseOverlay');
  if (noiseEl) noiseEl.style.opacity = _noiseOn ? '1' : '0';
}

export function setEasingMode(mode) {
  _easingMode = mode;
  window._easingMode = mode;
  updateEasingBar();
  renderGradBg(_stops);
}

function updateEasingBar() {
  document.querySelectorAll('.pd-ease-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ease === _easingMode);
  });
}

// ── Keyboard / swipe ───────────────────────────────────────────────────────────
function _onKeyDown(e) {
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  if ((e.key === 'c' || e.key === 'C') && (e.metaKey || e.ctrlKey)) {
    const json = getDetailedPaletteJSON();
    if (json) {
      e.preventDefault();
      copyToClipboard(json, 'Palette copied to clipboard.');
    }
    return;
  }

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pdNext(); }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); pdPrev(); }
  if (e.key === 'Escape') closePaletteDetail();
  if (e.key === '.') { e.preventDefault(); togglePinFromDetail(); }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); pdToggleReverse(); }
}
function _onSwipeStart(e) { _swipeStartX = e.touches[0].clientX; _swipeStartY = e.touches[0].clientY; }
function _onSwipeEnd(e) {
  if (_swipeStartX === null) return;
  const dx = e.changedTouches[0].clientX - _swipeStartX;
  const dy = e.changedTouches[0].clientY - _swipeStartY;
  _swipeStartX = null; _swipeStartY = null;
  if (Math.abs(dx) > 50 && Math.abs(dy) < 100) dx < 0 ? pdNext() : pdPrev();
}

// ── Main render ────────────────────────────────────────────────────────────────
function render() {
  const container = document.getElementById('pdStopsContainer');
  const panel     = document.getElementById('pdStopsPanel');
  const mobile  = isMobile();
  const panelSz = panel ? (mobile ? panel.offsetWidth : panel.offsetHeight) : 0;

  let dispOrder, ghostId = null;
  if (_drag?.type === 'stop') {
    const ib = _drag.insertBefore ?? _drag.idx;
    ghostId   = _drag.id;
    dispOrder = tentativeOrder(_drag.idx, ib);
    renderGradBg(dispOrder);
  } else if (_drag?.type === 'tile' && _drag.insertBefore != null) {
    const n = _stops.length + 1, w = 100 / n;
    const tmp = _stops.map(s => ({...s, weight: w}));
    tmp.splice(_drag.insertBefore, 0, {hex: _drag.hex, name: _drag.name, weight: w});
    renderGradBg(tmp);
    dispOrder = _stops;
  } else {
    dispOrder = _stops;
    renderGradBg(_stops);
  }

  if (container && panel) {
    const pos = blockPositions(dispOrder, panelSz);
    const existing = {};
    container.querySelectorAll('.pd-block[data-pid]').forEach(el => { existing[el.dataset.pid] = el; });
    const used = new Set();
    const updates = [];

    dispOrder.forEach((s, i) => {
      const k = String(s.id);
      used.add(k);
      let el = existing[k];
      if (!el) {
        el = document.createElement('div');
        el.className = 'pd-block';
        el.dataset.pid = k;
        const glaze = GLAZES.find(g => g.name === s.name);
        const fin   = _finLabel(glaze);
        el.innerHTML = `
          <div class="pd-block-fill" style="background:${_dispHex(s)}"></div>
          <div class="pd-block-info">
            <div class="pd-block-name">${s.name}<span class="pd-block-fin">${fin}</span></div>
            <div class="pd-block-hex">${s.hex}</div>
          </div>
          <button class="pd-block-del" title="Remove">✕</button>`;
        container.appendChild(el);
        el.querySelector('.pd-block-del').addEventListener('mousedown', e => e.stopPropagation());
        el.querySelector('.pd-block-del').addEventListener('click', e => {
          e.stopPropagation();
          const idx = _stops.findIndex(st => st.id === s.id);
          if (idx > -1) {
            _stops.splice(idx, 1);
            if (_stops.length) { const w = 100/_stops.length; _stops.forEach(s => s.weight = w); }
            sync(); render();
          }
        });
        el.addEventListener('mousedown', e => onBlockDown(e, s));
        el.addEventListener('touchstart', e => onBlockDown(e, s), {passive: false});
      }
      const isGhost = _drag?.type === 'stop' && s.id === ghostId;
      el.classList.toggle('is-ghost', isGhost);
      if (!isGhost) el.classList.remove('is-dragging');
      updates.push({el, p: pos[i], s});
    });

    Object.keys(existing).forEach(k => { if (!used.has(k)) existing[k].remove(); });

    container.querySelectorAll('.pd-drop-gap').forEach(e => e.remove());
    if (_drag?.insertBefore != null) {
      const gapPos = pos[_drag.insertBefore];
      const gap = document.createElement('div');
      gap.className = 'pd-drop-gap open';
      if (mobile) gap.style.left = (gapPos?.start ?? panelSz) + 'px';
      else         gap.style.top  = (gapPos?.start ?? panelSz) + 'px';
      container.appendChild(gap);
    }

    container.querySelectorAll('.pd-resize').forEach(e => e.remove());
    if (!mobile && (!_drag || _drag.type === 'resize')) {
      pos.forEach((p, i) => {
        if (i === dispOrder.length - 1) return;
        const h = document.createElement('div');
        h.className = 'pd-resize';
        h.style.top = (p.start + p.size) + 'px';
        h.innerHTML = '<div class="pd-resize-bar"><span></span><span></span></div>';
        container.appendChild(h);
        h.addEventListener('mousedown', e => onResizeDown(e, i));
        h.addEventListener('touchstart', e => onResizeDown(e, i), {passive: false});
      });
    }

    requestAnimationFrame(() => {
      updates.forEach(({el, p}) => {
        if (mobile) {
          el.style.top='0'; el.style.bottom='0';
          el.style.left=p.start+'px'; el.style.width=p.size+'px'; el.style.height='';
        } else {
          el.style.top=p.start+'px'; el.style.height=p.size+'px'; el.style.left=''; el.style.width='';
        }
      });
      if (_drag?.type === 'stop' && !mobile) {
        const dragEl = container.querySelector(`[data-pid="${_drag.id}"]`);
        if (dragEl) {
          const rect = panel.getBoundingClientRect();
          const relY = _drag.currentY - rect.top;
          const tot  = _stops.reduce((a,s) => a + s.weight, 0) || 1;
          const h    = (_stops.find(s => s.id === _drag.id)?.weight / tot) * panelSz || 60;
          dragEl.classList.remove('is-ghost'); dragEl.classList.add('is-dragging');
          dragEl.style.top = (relY - _drag.grabOffset) + 'px';
          dragEl.style.height = h + 'px'; dragEl.style.transition = 'none';
        }
      }
    });
  }
  renderPickerHighlights();
  requestAnimationFrame(_renderCanvasEdit);
}

// ── Resize drag ────────────────────────────────────────────────────────────────
function onResizeDown(e, idx) {
  e.preventDefault(); e.stopPropagation();
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  _drag = {type:'resize', idx, startY:cy};
  e.currentTarget.classList.add('resizing');
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup',   onResizeUp);
  document.addEventListener('touchmove', onResizeMove, {passive:false});
  document.addEventListener('touchend',  onResizeUp);
}
function onResizeMove(e) {
  if (!_drag || _drag.type !== 'resize') return;
  e.preventDefault();
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const dy = cy - _drag.startY; _drag.startY = cy;
  const panelH = document.getElementById('pdStopsPanel').offsetHeight || 600;
  const dw = (dy / panelH) * 100;
  const a = _stops[_drag.idx], b = _stops[_drag.idx + 1];
  if (!a || !b) return;
  const na = a.weight + dw, nb = b.weight - dw;
  if (na < MIN_W || nb < MIN_W) return;
  a.weight = na; b.weight = nb;
  render();
}
function onResizeUp() {
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup',   onResizeUp);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend',  onResizeUp);
  document.querySelectorAll('.pd-resize').forEach(el => el.classList.remove('resizing'));
  sync(); _drag = null; render();
}

// ── Block drag (reorder) + swipe-to-change ────────────────────────────────────
function onBlockDown(e, s) {
  if (e.target.closest('.pd-block-del')) return;
  e.preventDefault();
  const mobile = isMobile();
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const rect = e.currentTarget.getBoundingClientRect();
  const grabOffset = mobile ? (cx - rect.left) : (cy - rect.top);
  const idx = _stops.findIndex(st => st.id === s.id);
  if (idx === -1) return;
  _drag = {type:'stop', idx, id:s.id, hex:s.hex, name:s.name,
           startY:cy, currentY:cy, startX:cx, currentX:cx,
           grabOffset, insertBefore:idx, startTime:Date.now()};
  document.addEventListener('mousemove', onBlockMove);
  document.addEventListener('mouseup',   onBlockUp);
  document.addEventListener('touchmove', onBlockMove, {passive:false});
  document.addEventListener('touchend',  onBlockUp);
}
function onBlockMove(e) {
  if (!_drag) return;
  e.preventDefault();
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  _drag.currentY = cy; _drag.currentX = cx;
  const mobile  = isMobile();
  const panel   = document.getElementById('pdStopsPanel');
  const panelSz = mobile ? panel.offsetWidth : panel.offsetHeight;
  const rect    = panel.getBoundingClientRect();
  const relPos  = mobile ? cx - rect.left : cy - rect.top;
  const pos     = blockPositions(_stops, panelSz);
  let insertBefore = _stops.length;
  for (let i = 0; i < pos.length; i++) {
    if (i === _drag.idx) continue;
    if (relPos < pos[i].start + pos[i].size / 2) { insertBefore = i; break; }
  }
  _drag.insertBefore = insertBefore;
  render();
}
function onBlockUp(e) {
  document.removeEventListener('mousemove', onBlockMove);
  document.removeEventListener('mouseup',   onBlockUp);
  document.removeEventListener('touchmove', onBlockMove);
  document.removeEventListener('touchend',  onBlockUp);

  // Touch swipe-to-cycle-similar: short horizontal gesture on a block
  if (e.type === 'touchend' && _drag) {
    const dx = _drag.currentX - _drag.startX;
    const dy = _drag.currentY - _drag.startY;
    const elapsed = Date.now() - (_drag.startTime || 0);
    // 30-110px horizontal, < 40px vertical drift, under 450ms = glaze swap
    if (Math.abs(dx) > 30 && Math.abs(dx) < 110 && Math.abs(dy) < 40 && elapsed < 450) {
      const stop = _stops.find(s => s.id === _drag.id);
      if (stop) swipeBlockGlaze(stop, dx < 0 ? 'next' : 'prev');
      _drag = null; render(); return;
    }
  }

  if (_drag?.insertBefore != null && _drag.insertBefore !== _drag.idx && _drag.insertBefore !== _drag.idx + 1) {
    const [moved] = _stops.splice(_drag.idx, 1);
    const at = _drag.insertBefore > _drag.idx ? _drag.insertBefore - 1 : _drag.insertBefore;
    _stops.splice(at, 0, moved);
  }
  document.querySelectorAll('.pd-block').forEach(el => { el.classList.remove('is-dragging','is-ghost'); el.style.transition=''; });
  sync(); _drag = null; render();
}

// ── Tile drag from picker ──────────────────────────────────────────────────────
function onTileDown(e, g) {
  if (isMobile()) return;
  e.preventDefault();
  const cx = e.clientX, cy = e.clientY;
  const ghost = document.getElementById('pdGhost');
  ghost.style.background = g.hex; ghost.style.display = 'block';
  ghost.style.left = (cx-40)+'px'; ghost.style.top = (cy-25)+'px';
  document.getElementById('pdGhostLabel').textContent = g.name;
  _drag = {type:'tile', hex:g.hex, name:g.name, insertBefore:null};
  document.addEventListener('mousemove', onTileMove);
  document.addEventListener('mouseup',   onTileUp);
}
function onTileMove(e) {
  if (!_drag || _drag.type !== 'tile') return;
  e.preventDefault();
  const cx = e.clientX, cy = e.clientY;
  const ghost = document.getElementById('pdGhost');
  ghost.style.left = (cx-40)+'px'; ghost.style.top = (cy-25)+'px';
  const panel = document.getElementById('pdStopsPanel');
  const rect  = panel.getBoundingClientRect();
  if (cx < rect.left || cx > rect.right) {
    if (_drag.insertBefore !== null) { _drag.insertBefore = null; render(); }
    return;
  }
  const relY = cy - rect.top;
  const pos  = blockPositions(_stops, panel.offsetHeight);
  let insertBefore = _stops.length;
  for (let i = 0; i < pos.length; i++) {
    if (relY < pos[i].start + pos[i].size / 2) { insertBefore = i; break; }
  }
  if (_drag.insertBefore !== insertBefore) { _drag.insertBefore = insertBefore; render(); }
}
function onTileUp() {
  document.removeEventListener('mousemove', onTileMove);
  document.removeEventListener('mouseup',   onTileUp);
  document.getElementById('pdGhost').style.display = 'none';
  if (_drag?.insertBefore != null) { insertStop(_drag.name, _drag.hex, _drag.insertBefore); sync(); }
  _drag = null; render();
}

// ── Picker ─────────────────────────────────────────────────────────────────────
function buildPicker() {
  const grid = document.getElementById('pdPickerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  GLAZES.forEach(g => {
    const tile = document.createElement('div');
    tile.className = 'pd-tile';
    tile.dataset.glazeName = g.name;
    tile.style.background = g.hex;
    tile.title = `${g.name} · ${_finLabel(g)}`;
    tile.innerHTML = `<div class="pd-tile-name">${g.name}</div>`;
    tile.addEventListener('click', () => { insertStop(g.name, g.hex, _stops.length); sync(); render(); });
    tile.addEventListener('mousedown', e => onTileDown(e, g));
    grid.appendChild(tile);
  });
}
function renderPickerHighlights() {
  const inStops = new Set(_stops.map(s => s.name));
  document.querySelectorAll('.pd-tile').forEach(el => {
    el.classList.toggle('in-stops', inStops.has(el.dataset.glazeName));
  });
}

// ── Utility actions ────────────────────────────────────────────────────────────
export function pdRedistribute() {
  if (!_stops.length) return;
  const w = 100 / _stops.length;
  _stops.forEach(s => s.weight = w);
  render(); sync();
}

export function pdCopyNames() {
  const names = _stops.map(s => s.name).join(', ');
  navigator.clipboard?.writeText(names);
  const btn = document.getElementById('pdCopyBtn');
  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy names', 1400); }
}

// ── Open / close ───────────────────────────────────────────────────────────────
export function openPaletteDetail(key, fallback) {
  // Determine all available keys from the current DOM gallery where the card resides
  const cardEl = document.querySelector(`.card[data-key="${CSS.escape(key)}"]`);
  let containerEl = cardEl ? cardEl.closest('#gallery, #savedGallery') : null;
  if (!containerEl) {
    const exploreOpen = document.getElementById('view_explore')?.classList.contains('active') || currentTab === 'explore';
    containerEl = document.getElementById(exploreOpen ? 'gallery' : 'savedGallery');
  }

  if (containerEl) {
    const cards = [...containerEl.querySelectorAll('.card')];
    _allKeys = cards.map(c => c.dataset.key).filter(Boolean);
  } else {
    _allKeys = likedMeta.map(m => m.key);
  }

  _keyIdx = _allKeys.indexOf(key);
  if (_keyIdx === -1) {
    _allKeys = likedMeta.map(m => m.key);
    _keyIdx = _allKeys.indexOf(key);
  }
  if (_keyIdx === -1) {
    _allKeys = [key];
    _keyIdx = 0;
  }
  _nid = 0; _drag = null;

  // A rated palette (via the Rate Views card sort) carries its own preferred
  // view/reverse — honor that over the gallery-wide toggle. Otherwise default
  // to whatever the gallery is currently showing, so opening a conic gallery
  // view lands you in conic here too.
  const pref = (typeof viewPrefs !== 'undefined' && viewPrefs[key]) || null;
  if (pref) {
    _gradMode = pref.mode;
    _gradReverse = !!pref.reverse;
  } else {
    const modeMap = {linear:'linear', radial:'radial', conic:'conic', stripes:'stripes', turrell:'turrell', squeeze:'squeeze', bulge:'bulge', wada:'wada', flavin:'flavin', mondrian:'mondrian'};
    _gradMode = modeMap[typeof galleryViewMode !== 'undefined' ? galleryViewMode : null] || 'linear';
    _gradReverse = false;
  }

  // Stop blocks are cached by id in render(); ids restart at 0 each open, so
  // stale elements from a prior open (e.g. before a clay change) must be
  // cleared or they'd be reused with their old, now-wrong swatch color.
  const container = document.getElementById('pdStopsContainer');
  if (container) container.innerHTML = '';

  const overlay = document.getElementById('paletteDetail');
  overlay.style.display = 'flex';
  overlay.setAttribute('tabindex', '-1');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    overlay.focus();
  });

  _loadKeyData(key, fallback);
  updateNav();
  updateModeBar();
  updateEasingBar();
  updatePinBadge();
  buildPicker();
  requestAnimationFrame(() => render());

  window.addEventListener('resize', render);
  document.addEventListener('keydown', _onKeyDown);
  const grad = document.getElementById('pdGradient');
  if (grad) {
    grad.addEventListener('touchstart', _onSwipeStart, {passive:true});
    grad.addEventListener('touchend',   _onSwipeEnd,   {passive:true});
  }
}

export function closePaletteDetail() {
  const overlay = document.getElementById('paletteDetail');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 180);
  document.body.style.overflow = '';
  window.removeEventListener('resize', render);
  document.removeEventListener('keydown', _onKeyDown);
  const grad = document.getElementById('pdGradient');
  if (grad) {
    grad.removeEventListener('touchstart', _onSwipeStart);
    grad.removeEventListener('touchend',   _onSwipeEnd);
  }

  // Restore focus to the last focused card, or document body
  if (typeof _focusedCardKey !== 'undefined' && _focusedCardKey) {
    const card = document.querySelector(`.card[data-key="${CSS.escape(_focusedCardKey)}"]`);
    if (card) {
      card.focus();
    } else {
      document.body.focus();
    }
  } else {
    document.body.focus();
  }

  _key = null; _stops = []; _drag = null; _allKeys = []; _keyIdx = -1; _navigating = false;
  _gradMode = 'linear'; _noiseOn = false; _gradReverse = false;
}

// ── DIRECT CANVAS EDITING (Integrated from Flow Mode) ──────────────────────────
function _getCenter(w, h) {
  const mobile = isMobile();
  return {
    x: mobile ? (w * 0.5) : (w * 0.5 - 140),
    y: h * 0.5
  };
}

function _conicRingRadius(w, h) {
  const mobile = isMobile();
  const visibleW = mobile ? w : w - 280;
  return Math.min(visibleW, h) * 0.33;
}

function _axisPoint(mode, t, w, h) {
  const ctr = _getCenter(w, h);
  if (mode === 'conic') {
    const r = _conicRingRadius(w, h), a = t * 2 * Math.PI; // 0 = top, clockwise
    return { x: ctr.x + r * Math.sin(a), y: ctr.y - r * Math.cos(a) };
  }
  const botMargin = 70;
  const topMargin = 70;
  if (mode === 'radial' || mode === 'turrell') {
    return { x: ctr.x, y: ctr.y + t * Math.max(1, h - ctr.y - botMargin) };
  }
  return { x: ctr.x, y: topMargin + t * Math.max(1, h - topMargin - botMargin) };
}

function _axisPos(mode, x, y, w, h) {
  const ctr = _getCenter(w, h);
  if (mode === 'conic') {
    const a = Math.atan2(x - ctr.x, -(y - ctr.y));
    return (a / (2 * Math.PI) + 1) % 1;
  }
  const botMargin = 70;
  const topMargin = 70;
  if (mode === 'radial' || mode === 'turrell') {
    return Math.min(1, Math.max(0, (y - ctr.y) / Math.max(1, h - ctr.y - botMargin)));
  }
  return Math.min(1, Math.max(0, (y - topMargin) / Math.max(1, h - topMargin - botMargin)));
}

function _offAxisDistance(mode, x, y, w, h) {
  const ctr = _getCenter(w, h);
  if (mode === 'conic') {
    const dx = x - ctr.x, dy = y - ctr.y;
    return Math.abs(Math.hypot(dx, dy) - _conicRingRadius(w, h));
  }
  return Math.abs(x - ctr.x);
}

function _renderCanvasEdit() {
  const layer = document.getElementById('pdEditLayer');
  if (!layer) return;
  layer.innerHTML = '';

  const w = layer.clientWidth, h = layer.clientHeight;
  if (!w || !h) {
    const overlay = document.getElementById('paletteDetail');
    if (overlay && overlay.classList.contains('open')) {
      requestAnimationFrame(_renderCanvasEdit);
    }
    return;
  }

  const mode = _gradMode;
  const n = _stops.length;
  if (n < 2) return;

  // Render the axis
  if (mode === 'conic') {
    const r = _conicRingRadius(w, h);
    const ctr = _getCenter(w, h);
    const ring = document.createElement('div');
    ring.className = 'flow-axis-ring';
    Object.assign(ring.style, {
      left: (ctr.x - r) + 'px',
      top: (ctr.y - r) + 'px',
      width: (2 * r) + 'px',
      height: (2 * r) + 'px',
    });
    layer.appendChild(ring);
  } else {
    const a0 = _axisPoint(mode, 0, w, h), a1 = _axisPoint(mode, 1, w, h);
    const line = document.createElement('div');
    line.className = 'flow-axis-line';
    Object.assign(line.style, {
      left: a0.x + 'px',
      top: a0.y + 'px',
      height: (a1.y - a0.y) + 'px'
    });
    layer.appendChild(line);
  }

  // Calculate cumulative boundaries and midpoints
  const tot = _stops.reduce((acc, s) => acc + s.weight, 0) || 1;
  let running = 0;
  const boundaries = [];
  const midpoints = [];

  _stops.forEach((s, i) => {
    const start = running;
    running += s.weight;
    const end = running;

    midpoints.push({
      idx: i,
      stop: s,
      pos: (start + end) / 2 / tot
    });

    if (i < n - 1) {
      boundaries.push({
        idx: i,
        pos: end / tot
      });
    }
  });

  // Render boundary handles (n-1 dividers)
  boundaries.forEach((b) => {
    const dispPos = _gradReverse ? (1 - b.pos) : b.pos;
    const pt = _axisPoint(mode, dispPos, w, h);
    const handle = document.createElement('div');
    handle.className = 'flow-stop'; // Re-use flow handle styles
    handle.dataset.i = b.idx;
    Object.assign(handle.style, {
      left: pt.x + 'px',
      top: pt.y + 'px',
      background: 'var(--white)',
      border: '1.5px solid var(--ink)',
      boxShadow: '0 1px 6px rgba(0,0,0,.3)'
    });
    layer.appendChild(handle);

    handle.addEventListener('pointerdown', e => _onCanvasHandleDown(e, b.idx));
  });

  // Render segment labels at midpoints
  midpoints.forEach((m) => {
    const dispPos = _gradReverse ? (1 - m.pos) : m.pos;
    const pt = _axisPoint(mode, dispPos, w, h);

    const lbl = document.createElement('div');
    lbl.className = 'flow-stop-lbl'; // Re-use flow label styles
    lbl.innerHTML = `
      <span>${m.stop.name}</span>
      <div class="pctxt">${Math.round(m.stop.weight)}%</div>
    `;

    if (pt.x > w - 130) {
      lbl.style.left = '';
      lbl.style.right = (w - pt.x + 18) + 'px';
    } else {
      lbl.style.right = '';
      lbl.style.left = (pt.x + 18) + 'px';
    }
    lbl.style.top = pt.y + 'px';
    layer.appendChild(lbl);

    lbl.addEventListener('pointerdown', e => _onCanvasLabelDown(e, m.idx));
  });
}

function _onCanvasHandleDown(e, idx) {
  e.preventDefault(); e.stopPropagation();
  const layer = document.getElementById('pdEditLayer');
  const w = layer.clientWidth, h = layer.clientHeight;

  const onMove = ev => {
    const rect = layer.getBoundingClientRect();
    const rx = ev.clientX - rect.left;
    const ry = ev.clientY - rect.top;
    const t = _axisPos(_gradMode, rx, ry, w, h);
    const actualT = _gradReverse ? (1 - t) : t;

    const tot = _stops.reduce((acc, s) => acc + s.weight, 0) || 1;
    let running = 0;
    const bPos = [];
    _stops.forEach(s => {
      running += s.weight;
      bPos.push(running / tot);
    });

    const prevB = idx > 0 ? bPos[idx - 1] : 0;
    const nextB = bPos[idx + 1];

    const minPct = MIN_W / 100;
    const clampedT = Math.min(nextB - minPct, Math.max(prevB + minPct, actualT));

    const a = _stops[idx], b = _stops[idx + 1];
    const targetAWeight = (clampedT - prevB) * 100;
    const targetBWeight = (nextB - clampedT) * 100;

    a.weight = targetAWeight;
    b.weight = targetBWeight;

    renderGradBg(_stops);
    _renderCanvasEditPositions();

    // Update block positions in place in Stops panel
    const panel = document.getElementById('pdStopsPanel');
    const panelSz = isMobile() ? panel.offsetWidth : panel.offsetHeight;
    const pos = blockPositions(_stops, panelSz);
    const container = document.getElementById('pdStopsContainer');
    _stops.forEach((s, i) => {
      const el = container.querySelector(`[data-pid="${s.id}"]`);
      if (el) {
        if (isMobile()) {
          el.style.left = pos[i].start + 'px'; el.style.width = pos[i].size + 'px';
        } else {
          el.style.top = pos[i].start + 'px'; el.style.height = pos[i].size + 'px';
        }
      }
    });
  };

  const onUp = ev => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    sync();
    render();
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function _renderCanvasEditPositions() {
  const layer = document.getElementById('pdEditLayer');
  const w = layer.clientWidth, h = layer.clientHeight;
  const tot = _stops.reduce((acc, s) => acc + s.weight, 0) || 1;
  let running = 0;
  const boundaries = [];
  const midpoints = [];

  _stops.forEach((s, i) => {
    const start = running;
    running += s.weight;
    const end = running;
    midpoints.push({ idx: i, weight: s.weight, name: s.name, pos: (start + end) / 2 / tot });
    if (i < _stops.length - 1) {
      boundaries.push({ idx: i, pos: end / tot });
    }
  });

  layer.querySelectorAll('.flow-stop').forEach((el, idx) => {
    const b = boundaries[idx];
    if (!b) return;
    const dispPos = _gradReverse ? (1 - b.pos) : b.pos;
    const pt = _axisPoint(_gradMode, dispPos, w, h);
    el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px';
  });

  layer.querySelectorAll('.flow-stop-lbl').forEach((el, idx) => {
    const m = midpoints[idx];
    if (!m) return;
    const dispPos = _gradReverse ? (1 - m.pos) : m.pos;
    const pt = _axisPoint(_gradMode, dispPos, w, h);
    el.querySelector('span').textContent = m.name;
    el.querySelector('.pctxt').textContent = Math.round(m.weight) + '%';
    if (pt.x > w - 130) {
      el.style.left = ''; el.style.right = (w - pt.x + 18) + 'px';
    } else {
      el.style.right = ''; el.style.left = (pt.x + 18) + 'px';
    }
    el.style.top = pt.y + 'px';
  });
}

function _onCanvasLabelDown(e, idx) {
  e.preventDefault(); e.stopPropagation();
  const layer = document.getElementById('pdEditLayer');
  const w = layer.clientWidth, h = layer.clientHeight;
  const stop = _stops[idx];

  const REMOVE_DIST = 90;
  const lblEl = e.currentTarget;

  const onMove = ev => {
    const rect = layer.getBoundingClientRect();
    const rx = ev.clientX - rect.left;
    const ry = ev.clientY - rect.top;
    const off = _offAxisDistance(_gradMode, rx, ry, w, h);
    lblEl.style.opacity = off > REMOVE_DIST ? '.4' : '1';
  };

  const onUp = ev => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    const rect = layer.getBoundingClientRect();
    const rx = ev.clientX - rect.left;
    const ry = ev.clientY - rect.top;
    const off = _offAxisDistance(_gradMode, rx, ry, w, h);

    if (off > REMOVE_DIST && _stops.length > 2) {
      _stops.splice(idx, 1);
      const newW = 100 / _stops.length;
      _stops.forEach(s => s.weight = newW);
      sync();
      render();
    } else {
      lblEl.style.opacity = '1';
      const tile = document.querySelector(`.pd-tile[data-glaze-name="${stop.name}"]`);
      if (tile) {
        tile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        tile.classList.add('flash-active');
        setTimeout(() => tile.classList.remove('flash-active'), 800);
      }
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// One-time setup to bind title editing
if (typeof document !== 'undefined') {
  const setupTitleListener = () => {
    const titleInput = document.getElementById('pdTitle');
    const gradTitleInput = document.getElementById('pdGradientTitle');
    
    const handleInput = (sourceEl, targetEl) => {
      if (!_key) return;
      const val = sourceEl.value.trim() || 'Palette';
      
      if (targetEl) targetEl.value = sourceEl.value;
      
      // Save to labelStore
      if (typeof labelStore !== 'undefined') {
        labelStore[_key] = val;
      }
      
      // Update likedMeta if pinned
      const m = likedMeta.find(x => x.key === _key);
      if (m) {
        m.label = val;
      }
      
      // Save changes
      saveAll();
      
      // Refresh UI components
      window.renderSidebar?.();
      window.renderSavedSection?.();
      window.renderGallery?.();
    };

    if (titleInput) {
      titleInput.addEventListener('input', () => handleInput(titleInput, gradTitleInput));
    }
    if (gradTitleInput) {
      gradTitleInput.addEventListener('input', () => handleInput(gradTitleInput, titleInput));
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTitleListener);
  } else {
    setupTitleListener();
  }
}

export function getDetailedPaletteJSON() {
  if (!_key) return null;
  const title = document.getElementById('pdTitle')?.value || document.getElementById('pdGradientTitle')?.value || '';
  return JSON.stringify({
    names: _stops.map(s => s.name),
    label: title.trim() || 'Palette',
    feeling: '',
    tag: 'Copied'
  });
}
