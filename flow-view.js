// ── FLOW MODE ─────────────────────────────────────────────────────────────────
// Full-screen rapid gradient scroll experience. Spec:
// docs/superpowers/specs/2026-07-04-flow-mode-design.md
// Pure math lives in flow-core.js; this module owns DOM and gestures.
// Globals (clayKey, levers, likedKeys, likedMeta, activeContext, projects,
// activePreset) are window vars declared in index.html.
import { VIEW_MODES } from './view-rating.js';
import { GLAZES, CLAY } from './glazes-data.js';
import {
  generatePalette, generateBandingPalette, withKey, mkid, getPool, doRiff,
  applyGlaze, toHex, showToast, renderSidebar, renderTopbarTabs, updateCount,
} from './render.js';
import { saveAll } from './persistence.js';
import {
  equalStops, moveStop, insertStop, removeStop, replaceStopHex, midpoints,
  axisPoint, axisPos, offAxisDistance, conicRingRadius, windowRange,
  flowGradientCSS, FLOW_MAX_STOPS,
} from './flow-core.js';

let _open = false;
let _idx = 0;                 // current feed index
let _styleIdx = 0;            // index into VIEW_MODES
let _editing = false;
export const flowHistory = [];   // palettes, index-aligned with feed position
window.flowHistory = flowHistory;
let _isEdited = false;

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
  feed.addEventListener('pointerdown', _onHoldStart);
  feed.addEventListener('pointermove', _onHoldMove);
  feed.addEventListener('pointercancel', _onHoldCancel);
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
  $('flowFeed').removeEventListener('pointerdown', _onHoldStart);
  $('flowFeed').removeEventListener('pointermove', _onHoldMove);
  $('flowFeed').removeEventListener('pointercancel', _onHoldCancel);
}

function _onKey(e) {
  if (!_open) return;
  if (e.key === 'Escape') { e.stopPropagation(); _editing ? _exitEdit() : closeFlow(); return; }
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); _saveCurrent(); return; }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); _enterEdit(); return; }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); _flipCurrent(); return; }
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
  el.style.background = '';
  el.style.backgroundImage = '';
  el.style.backgroundSize = '';
  el.style.backgroundPosition = '';
  el.style.backgroundRepeat = '';
  el.style.backgroundColor = '';

  const css = flowGradientCSS(_mode(), _ensureStops(p), CLAY[clayKey]);
  Object.assign(el.style, css);

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
  clearTimeout(_holdTimer);
  if (_arcOpen) return;
  if (_editing) return;
  if (e.target.closest('.flow-x')) return;
  const now = performance.now();
  if (_lastTapT && now - _lastTapT < 300) {           // double tap → save (Task 9)
    clearTimeout(_tapTimer); _lastTapT = 0;
    _saveCurrent();
    return;
  }
  _lastTapT = now;
  _tapTimer = setTimeout(() => _enterEdit(), 250);
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
  if (_isEdited) {
    _saveCurrent();
    _isEdited = false;
  }
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

function _syncGlazesFromStops(p) {
  p.glazes = p.stops.map(s => GLAZES.find(g => g.name === s.name)).filter(Boolean);
  Object.assign(p, withKey(p));
}

function _refreshCurrentCard() {
  const el = _mounted.get(_idx);
  if (!el) return;
  _applyCardStyle(el, _current());
  el.querySelector('.flow-names')?.replaceWith(_buildNames(_current()));
}

// ── EDIT: DRAG ────────────────────────────────────────────────────────────────
const REMOVE_DIST = 90;   // px off-axis to remove a stop

const _dragPos = (x, y, w, h) => {
  const t = axisPos(_mode(), x, y, w, h);
  return _mode() === 'turrell' ? 1 - t : t;
};

function _onStopDown(e, i) {
  e.preventDefault();
  const layer = $('flowEditLayer');
  const w = layer.clientWidth, h = layer.clientHeight;
  const p = _current();
  let idx = i;
  const hEl = layer.querySelector(`.flow-stop[data-i="${i}"]`);
  hEl.classList.add('active');
  hEl.setPointerCapture(e.pointerId);

  const onMove = ev => {
    const off = offAxisDistance(_mode(), ev.clientX, ev.clientY, w, h);
    hEl.style.opacity = off > REMOVE_DIST ? '.4' : '1';
    const t = _dragPos(ev.clientX, ev.clientY, w, h);
    const res = moveStop(p.stops, idx, t);
    p.stops = res.stops; idx = res.index;
    _syncGlazesFromStops(p);
    _refreshCurrentCard();
    _isEdited = true;
    _renderEditPositions();          // cheap reposition, no full rebuild
  };
  const onUp = ev => {
    hEl.removeEventListener('pointermove', onMove);
    hEl.removeEventListener('pointerup', onUp);
    const off = offAxisDistance(_mode(), ev.clientX, ev.clientY, w, h);
    if (off > REMOVE_DIST) {
      const next = removeStop(p.stops, idx);
      if (next !== p.stops) {
        p.stops = next;
        _syncGlazesFromStops(p);
        _refreshCurrentCard();
        _isEdited = true;
      }
    }
    _renderEdit();                   // full rebuild (labels, +, order)
  };
  hEl.addEventListener('pointermove', onMove);
  hEl.addEventListener('pointerup', onUp);
}

// Reposition handles/labels in place during a drag (rebuild-free).
function _renderEditPositions() {
  const layer = $('flowEditLayer');
  const w = layer.clientWidth, h = layer.clientHeight;
  const stops = _current().stops;
  layer.querySelectorAll('.flow-stop').forEach((el, domIdx) => {
    const s = stops[domIdx];
    if (!s) return;
    const pt = axisPoint(_mode(), _dispT(s.pos), w, h);
    el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px'; el.style.background = s.hex;
  });
  layer.querySelectorAll('.flow-stop-lbl').forEach((el, domIdx) => {
    const s = stops[domIdx];
    if (!s) return;
    const pt = axisPoint(_mode(), _dispT(s.pos), w, h);
    el.querySelector('span').textContent = s.name;
    el.querySelector('.pctxt').textContent = Math.round(s.pos * 100) + '%';
    if (pt.x > w - 130) { el.style.left = ''; el.style.right = (w - pt.x + 18) + 'px'; }
    else { el.style.right = ''; el.style.left = (pt.x + 18) + 'px'; }
    el.style.top = pt.y + 'px';
  });
}

// ── EDIT: PICKER (add + swap) ─────────────────────────────────────────────────
function _openPicker(replaceIdx, insertPos) {
  const picker = $('flowPicker');
  picker.innerHTML = '';
  getPool().forEach(g => {
    const row = document.createElement('div');
    row.className = 'flow-pick-row';
    const dot = document.createElement('i');
    const c = applyGlaze(g, clayKey);
    dot.style.background = toHex(c.r, c.gr, c.b);
    const nm = document.createElement('span');
    nm.className = 'flow-pick-name';
    nm.textContent = g.name;
    const fin = document.createElement('span');
    fin.className = 'flow-pick-fin';
    fin.textContent = g.fin;
    row.appendChild(dot); row.appendChild(nm); row.appendChild(fin);
    row.addEventListener('click', () => {
      const p = _current();
      const hex = toHex(c.r, c.gr, c.b);
      if (replaceIdx !== null && replaceIdx !== undefined) {
        p.stops = replaceStopHex(p.stops, replaceIdx, hex);
        p.stops[replaceIdx].name = g.name;
      } else {
        p.stops = insertStop(p.stops, insertPos, { name: g.name, hex });
      }
      _syncGlazesFromStops(p);
      _refreshCurrentCard();
      _isEdited = true;
      picker.hidden = true;
      _renderEdit();
    });
    picker.appendChild(row);
  });
  picker.hidden = false;
}

// ── SAVE ──────────────────────────────────────────────────────────────────────
function _pulse() {
  const el = $('flowPulse');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function _saveCurrent() {
  const p = _current();
  if (!likedKeys.has(p.key)) {
    likedKeys.add(p.key);
    if (!likedMeta.find(m => m.key === p.key)) {
      const meta = {
        key: p.key, label: p.label, feeling: '', tag: p.tag,
        names: p.glazes.map(g => g.name), hexes: p.glazes.map(g => g.hex),
      };
      if (activeContext !== 'global') meta.projectId = activeContext;
      likedMeta.push(meta);
    }
    saveAll(); renderSidebar(); renderTopbarTabs(); updateCount();
  }
  _pulse();   // saved or already-saved: always confirm visually, never unsave
}

function _flipCurrent() {
  const p = _current();
  const stops = _ensureStops(p);
  if (stops && stops.length) {
    stops.reverse();
    stops.forEach(s => { s.pos = 1 - s.pos; });
    stops.sort((a, b) => a.pos - b.pos);
    p.stops = stops;
  }
  p.glazes.reverse();
  p.key = p.glazes.map(g => g.name).join('|');
  _syncGlazesFromStops(p);
  _refreshCurrentCard();
  _isEdited = true;
  if (_editing) _renderEdit();
  _pulse();
  showToast('Gradient flipped');
}

// ── ARC MENU ──────────────────────────────────────────────────────────────────
const HOLD_MS = 450, HOLD_SLOP = 10;
let _holdTimer = null, _holdX = 0, _holdY = 0, _arcOpen = false;

const ARC_ITEMS = [
  { act: 'save-proj', icon: '▤', label: 'PROJECT' },
  { act: 'pin',       icon: '✦', label: 'PIN' },
  { act: 'riff',      icon: '⟳', label: 'RIFF' },
  { act: 'flip',      icon: '⇄', label: 'FLIP' },
];

function _onHoldStart(e) {
  if (_editing || _arcOpen) return;
  _holdX = e.clientX; _holdY = e.clientY;
  _holdTimer = setTimeout(() => _openArc(e.clientX, e.clientY), HOLD_MS);
}
function _onHoldMove(e) {
  if (_arcOpen) { _updateArcHot(e.clientX, e.clientY); return; }
  if (Math.hypot(e.clientX - _holdX, e.clientY - _holdY) > HOLD_SLOP) clearTimeout(_holdTimer);
}
function _onHoldCancel() { clearTimeout(_holdTimer); }

function _openArc(x, y) {
  if (navigator.vibrate) navigator.vibrate(30);
  _arcOpen = true;
  clearTimeout(_tapTimer);   // a hold is not a tap
  const arc = $('flowArc');
  arc.innerHTML = '';
  const w = arc.clientWidth || window.innerWidth;
  // fan the three buttons on a quarter arc opening toward screen center
  const toLeft = x > w / 2 ? -1 : 1;
  ARC_ITEMS.forEach((item, i) => {
    const a = (Math.PI / 2) * (i / (ARC_ITEMS.length - 1)) - Math.PI / 2; // -90°..0°
    const bx = x + toLeft * 96 * Math.cos(a), by = y + 96 * Math.sin(a);
    const btn = document.createElement('div');
    btn.className = 'flow-arc-btn';
    btn.dataset.act = item.act;
    btn.innerHTML = `${item.icon}<small>${item.label}</small>`;
    Object.assign(btn.style, { left: bx + 'px', top: by + 'px' });
    arc.appendChild(btn);
  });
  arc.hidden = false;
  document.addEventListener('pointerup', _onArcRelease, { once: true });
}

function _updateArcHot(x, y) {
  $('flowArc').querySelectorAll('.flow-arc-btn').forEach(btn => {
    const r = btn.getBoundingClientRect();
    const hit = x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8;
    btn.classList.toggle('hot', hit);
  });
}

function _onArcRelease(e) {
  const arc = $('flowArc');
  _updateArcHot(e.clientX, e.clientY);
  const hot = arc.querySelector('.flow-arc-btn.hot');
  arc.hidden = true; arc.innerHTML = ''; _arcOpen = false;
  _lastTapT = 0; clearTimeout(_tapTimer);   // swallow the tap this release would fire
  if (!hot) return;
  const act = hot.dataset.act;
  if (act === 'pin') _saveCurrent();
  if (act === 'riff') {
    const riffedList = doRiff(_current());
    const riffed = riffedList.find(r => r.key !== _current().key) || riffedList[0];
    if (riffed) {
      delete riffed.stops;
      flowHistory[_idx] = riffed;
      _refreshCurrentCard();
      showToast('Riffed');
    }
  }
  if (act === 'save-proj') _openProjectPicker();
  if (act === 'flip') _flipCurrent();
}

function _openProjectPicker() {
  const picker = $('flowPicker');
  picker.innerHTML = '';
  if (!projects.length) { showToast('No boards yet — create one in the sidebar'); return; }
  projects.forEach(proj => {
    const row = document.createElement('div');
    row.className = 'flow-pick-row';
    const nm = document.createElement('span');
    nm.className = 'flow-pick-name';
    nm.textContent = proj.name;
    row.appendChild(nm);
    row.addEventListener('click', () => {
      const p = _current();
      likedKeys.add(p.key);
      let meta = likedMeta.find(m => m.key === p.key);
      if (!meta) {
        meta = { key: p.key, label: p.label, feeling: '', tag: p.tag,
                 names: p.glazes.map(g => g.name), hexes: p.glazes.map(g => g.hex) };
        likedMeta.push(meta);
      }
      meta.projectId = proj.id;
      saveAll(); renderSidebar(); renderTopbarTabs(); updateCount();
      picker.hidden = true;
      _pulse();
      showToast(`Saved to "${proj.name}"`);
    });
    picker.appendChild(row);
  });
  picker.hidden = false;
}
