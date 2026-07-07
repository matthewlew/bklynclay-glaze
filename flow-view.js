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
  axisPoint, midpoints, conicRingRadius, FLOW_MAX_STOPS,
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
  feed.addEventListener('pointerup', _onPointerUp);
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
  $('flowFeed').removeEventListener('pointerup', _onPointerUp);
}

function _onKey(e) {
  if (!_open) return;
  if (e.key === 'Escape') { e.stopPropagation(); _editing ? _exitEdit() : closeFlow(); return; }
  if (_editing) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); _cycleStyle(1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); _cycleStyle(-1); }
}

let _flashT = null;
function _cycleStyle(dir) {
  _styleIdx = (_styleIdx + dir + VIEW_MODES.length) % VIEW_MODES.length;
  _renderStyleName();
  _renderDots();
  for (const [i, el] of _mounted) _applyCardStyle(el, flowHistory[i]);
  const pill = $('flowStyleName');
  pill.classList.remove('flash');
  void pill.offsetWidth;             // restart the transition
  pill.classList.add('flash');
  clearTimeout(_flashT);
  _flashT = setTimeout(() => pill.classList.remove('flash'), 300);
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

// ── EDIT MODE ─────────────────────────────────────────────────────────────────
let _tapTimer = null, _lastTapT = 0;
function _onPointerUp(e) {
  console.log('DEBUG onPointerUp', { editing: _editing, target: e.target.className });
  if (_editing) return;
  if (e.target.closest('.flow-x')) return;
  const now = performance.now();
  if (now - _lastTapT < 300) {           // double tap → save (Task 9)
    clearTimeout(_tapTimer); _lastTapT = 0;
    _saveCurrent();
    return;
  }
  _lastTapT = now;
  console.log('DEBUG scheduling enterEdit');
  _tapTimer = setTimeout(() => { console.log('DEBUG firing enterEdit'); _enterEdit(); }, 250);
}

function _current() { return flowHistory[_idx]; }

function _enterEdit() {
  if (_editing || !_open) return;
  _editing = true;
  $('flowFeed').style.overflow = 'hidden';
  $('flowEditLayer').hidden = false;
  _renderEdit();
}

function _exitEdit() {
  if (!_editing) return;
  _editing = false;
  $('flowFeed').style.overflow = '';
  const layer = $('flowEditLayer');
  layer.hidden = true;
  layer.innerHTML = '';
}

// Turrell renders stop pos=0 as the OUTERMOST square, so its handle must sit
// at the screen edge (t=1 on the center→edge axis): display t = 1 - pos.
const _dispT = (pos) => _mode() === 'turrell' ? 1 - pos : pos;

function _renderEdit() {
  const layer = $('flowEditLayer');
  layer.innerHTML = '';
  const w = layer.clientWidth, h = layer.clientHeight;
  const mode = _mode();
  const stops = _ensureStops(_current());

  // axis
  if (mode === 'conic') {
    const r = conicRingRadius(w, h);
    const ring = document.createElement('div');
    ring.className = 'flow-axis-ring';
    Object.assign(ring.style, {
      left: (w * 0.5 - r) + 'px', top: (h * 0.42 - r) + 'px',
      width: (2 * r) + 'px', height: (2 * r) + 'px',
    });
    layer.appendChild(ring);
  } else {
    const a0 = axisPoint(mode, 0, w, h), a1 = axisPoint(mode, 1, w, h);
    const line = document.createElement('div');
    line.className = 'flow-axis-line';
    Object.assign(line.style, { left: a0.x + 'px', top: a0.y + 'px', height: (a1.y - a0.y) + 'px' });
    layer.appendChild(line);
  }

  // handles + labels
  stops.forEach((s, i) => {
    const pt = axisPoint(mode, _dispT(s.pos), w, h);
    const hEl = document.createElement('div');
    hEl.className = 'flow-stop';
    hEl.dataset.i = i;
    Object.assign(hEl.style, { left: pt.x + 'px', top: pt.y + 'px', background: s.hex });
    hEl.addEventListener('pointerdown', ev => _onStopDown(ev, i));
    layer.appendChild(hEl);

    const lbl = document.createElement('div');
    lbl.className = 'flow-stop-lbl';
    // flip inward when the label would clip the screen edge
    const flip = pt.x > w - 130;
    Object.assign(lbl.style, flip
      ? { right: (w - pt.x + 18) + 'px', top: pt.y + 'px' }
      : { left: (pt.x + 18) + 'px', top: pt.y + 'px' });
    const nm = document.createElement('span'); nm.textContent = s.name;
    const pc = document.createElement('span'); pc.className = 'pctxt';
    pc.textContent = Math.round(s.pos * 100) + '%';
    lbl.appendChild(nm); lbl.appendChild(pc);
    lbl.addEventListener('click', () => _openPicker(i));   // Task 8
    layer.appendChild(lbl);
  });

  // + insert handles at midpoints (hidden at the 6-glaze cap)
  if (stops.length < FLOW_MAX_STOPS) {
    midpoints(stops).forEach(mp => {
      const pt = axisPoint(mode, _dispT(mp), w, h);
      const plus = document.createElement('div');
      plus.className = 'flow-plus';
      plus.textContent = '+';
      Object.assign(plus.style, { left: pt.x + 'px', top: pt.y + 'px' });
      plus.addEventListener('click', () => _openPicker(null, mp));  // Task 8
      layer.appendChild(plus);
    });
  }

  const hint = document.createElement('div');
  hint.className = 'flow-hint';
  hint.textContent = 'DRAG TO MOVE · + TO ADD · TAP TO SWAP · DRAG OFF TO REMOVE';
  layer.appendChild(hint);

  // downward swipe on the edit layer exits back to the feed
  let sy = 0;
  layer.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive: true });
  layer.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - sy > 80) _exitEdit();
  }, { passive: true });
}

// Implemented in Task 8 (drag + picker) and Task 9 (save):
function _onStopDown() {}
function _openPicker() {}
function _saveCurrent() {}
