// ── FLOW MODE ─────────────────────────────────────────────────────────────────
// Full-screen rapid gradient scroll experience. Spec:
// docs/superpowers/specs/2026-07-04-flow-mode-design.md
// Pure math lives in flow-core.js; this module owns DOM and gestures.
// Globals (clayKey, levers, likedKeys, likedMeta, activeContext, projects,
// activePreset) are window vars declared in index.html.
import { VIEW_MODES } from './view-rating.js';
import { GLAZES, CLAY } from './glazes-data.js';
import {
  generatePalette, generateBandingPalette, withKey, mkid,
  applyGlaze, toHex,
} from './render.js';
import {
  equalStops, windowRange, flowGradientCSS,
} from './flow-core.js';

let _open = false;
let _idx = 0;                 // current feed index
let _styleIdx = 0;            // index into VIEW_MODES
let _editing = false;
export const flowHistory = [];   // palettes, index-aligned with feed position

const $ = id => document.getElementById(id);
const _mode = () => VIEW_MODES[_styleIdx];

export function isFlowOpen() { return _open; }

export function openFlow() {
  if (_open) return;
  _open = true; _idx = 0; _editing = false;
  document.body.style.overflow = 'hidden';
  $('flowView').hidden = false;
  if (!flowHistory.length) flowHistory.push(_newPalette());
  _renderDots();
  _renderStyleName();
  _onIndexChange();
  const feed = $('flowFeed');
  feed.scrollTop = 0;
  feed.addEventListener('scroll', _onScroll, { passive: true });
  document.addEventListener('keydown', _onKey, true);
  feed.addEventListener('wheel', _onWheel, { passive: false });
  feed.addEventListener('touchstart', _onTouchStart, { passive: true });
  feed.addEventListener('touchend', _onTouchEnd, { passive: true });
}

export function closeFlow() {
  if (!_open) return;
  _open = false;
  document.body.style.overflow = '';
  $('flowView').hidden = true;
  $('flowFeed').removeEventListener('scroll', _onScroll);
  document.removeEventListener('keydown', _onKey, true);
  $('flowFeed').removeEventListener('wheel', _onWheel);
  $('flowFeed').removeEventListener('touchstart', _onTouchStart);
  $('flowFeed').removeEventListener('touchend', _onTouchEnd);
}

function _onKey(e) {
  if (!_open) return;
  if (e.key === 'Escape') { e.stopPropagation(); closeFlow(); }
  if (_editing) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); _cycleStyle(1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); _cycleStyle(-1); }
}

function _cycleStyle(dir) {
  _styleIdx = (_styleIdx + dir + VIEW_MODES.length) % VIEW_MODES.length;
  _renderStyleName();
  _renderDots();
  for (const [i, el] of _mounted) _applyCardStyle(el, flowHistory[i]);
  const pill = $('flowStyleName');
  pill.classList.remove('flash');
  void pill.offsetWidth;             // restart the transition
  pill.classList.add('flash');
  setTimeout(() => pill.classList.remove('flash'), 300);
}

let _wheelAccum = 0, _wheelT = 0;
function _onWheel(e) {
  if (_editing) return;
  const dx = e.shiftKey ? e.deltaY : e.deltaX;
  if (Math.abs(dx) <= Math.abs(e.deltaY) && !e.shiftKey) return; // vertical = feed scroll
  e.preventDefault();
  const now = performance.now();
  if (now - _wheelT > 400) _wheelAccum = 0;
  _wheelT = now;
  _wheelAccum += dx;
  if (Math.abs(_wheelAccum) > 60) { _cycleStyle(_wheelAccum > 0 ? 1 : -1); _wheelAccum = 0; }
}

let _tsX = 0, _tsY = 0;
function _onTouchStart(e) { _tsX = e.touches[0].clientX; _tsY = e.touches[0].clientY; }
function _onTouchEnd(e) {
  if (_editing) return;
  const dx = e.changedTouches[0].clientX - _tsX;
  const dy = e.changedTouches[0].clientY - _tsY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) _cycleStyle(dx < 0 ? 1 : -1);
}

function _renderStyleName() {
  $('flowStyleName').textContent = _mode().toUpperCase();
}

function _renderDots() {
  const dots = $('flowDots');
  dots.innerHTML = '';
  VIEW_MODES.forEach((_, i) => {
    const s = document.createElement('span');
    if (i === _styleIdx) s.classList.add('on');
    dots.appendChild(s);
  });
}

// ── PALETTE GENERATION ────────────────────────────────────────────────────────
function _newPalette() {
  for (let a = 0; a < 40; a++) {
    const glazes = Math.random() < 0.25 ? generateBandingPalette(levers) : generatePalette(levers);
    if (glazes && glazes.length >= 2)
      return withKey({ id: mkid(), label: 'Flow', feeling: '', tag: 'Flow', glazes });
  }
  // Over-constrained pool (e.g. narrow artist filter): never show a blank card.
  const g = [...GLAZES].sort(() => Math.random() - 0.5).slice(0, 2);
  return withKey({ id: mkid(), label: 'Flow', feeling: '', tag: 'Flow', glazes: g });
}

function _ensureStops(p) {
  if (!p.stops) {
    const eq = equalStops(p.glazes.map(g => {
      const c = applyGlaze(g, clayKey);
      return toHex(c.r, c.gr, c.b);
    }));
    p.stops = p.glazes.map((g, i) => ({ name: g.name, hex: eq[i].hex, pos: eq[i].pos }));
  }
  return p.stops;
}

// ── FEED RENDERING (windowed) ─────────────────────────────────────────────────
let _mounted = new Map();  // feed index -> card element

function _applyCardStyle(el, p) {
  const css = flowGradientCSS(_mode(), _ensureStops(p), CLAY[clayKey]);
  el.style.backgroundImage = css.backgroundImage || '';
  el.style.backgroundSize = css.backgroundSize || '';
  el.style.background = css.background;
  if (css.backgroundImage) el.style.backgroundImage = css.backgroundImage;
  if (css.backgroundSize) el.style.backgroundSize = css.backgroundSize;
  let ap = el.querySelector('.conic-aperture');
  if (_mode() === 'conic') {
    if (!ap) { ap = document.createElement('div'); ap.className = 'conic-aperture'; el.appendChild(ap); }
    ap.style.background = CLAY[clayKey];
  } else if (ap) ap.remove();
}

function _buildNames(p) {
  const wrap = document.createElement('div');
  wrap.className = 'flow-names';
  _ensureStops(p).forEach(s => {
    const row = document.createElement('div');
    row.className = 'flow-name-row';
    const dot = document.createElement('i');
    dot.style.background = s.hex;
    row.appendChild(dot);
    row.appendChild(document.createTextNode(s.name));
    wrap.appendChild(row);
  });
  return wrap;
}

function _buildCard(i) {
  const el = document.createElement('div');
  el.className = 'flow-card';
  el.dataset.idx = i;
  _applyCardStyle(el, flowHistory[i]);
  el.appendChild(_buildNames(flowHistory[i]));
  return el;
}

function _renderWindow() {
  const feed = $('flowFeed');
  const vh = feed.clientHeight;
  const { start, end } = windowRange(_idx, flowHistory.length);
  for (const [i, el] of [..._mounted]) {
    if (i < start || i > end) { el.remove(); _mounted.delete(i); }
  }
  const bottom = $('flowSpacerBottom');
  for (let i = start; i <= end; i++) {
    if (!_mounted.has(i)) {
      const el = _buildCard(i);
      feed.insertBefore(el, bottom);
      _mounted.set(i, el);
    }
  }
  // keep DOM order = index order (insertBefore above appends; sort explicitly)
  [..._mounted.keys()].sort((a, b) => a - b)
    .forEach(i => feed.insertBefore(_mounted.get(i), bottom));
  $('flowSpacerTop').style.height = (start * vh) + 'px';
  bottom.style.height = ((flowHistory.length - 1 - end) * vh) + 'px';
}

let _lastScrollTop = 0, _lastScrollT = 0;
function _onScroll() {
  if (_editing) return;
  const feed = $('flowFeed');
  const vh = feed.clientHeight;
  // velocity → fade names while flicking fast
  const now = performance.now();
  const v = Math.abs(feed.scrollTop - _lastScrollTop) / Math.max(1, now - _lastScrollT);
  _lastScrollTop = feed.scrollTop; _lastScrollT = now;
  feed.querySelectorAll('.flow-names').forEach(n => n.classList.toggle('fast', v > 1.2));
  const idx = Math.max(0, Math.round(feed.scrollTop / vh));
  if (idx !== _idx) { _idx = idx; _onIndexChange(); }
}

function _onIndexChange() {
  while (flowHistory.length < _idx + 6) flowHistory.push(_newPalette());
  _renderWindow();
}
