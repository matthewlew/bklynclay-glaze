// ── PALETTE DETAIL PAGE ────────────────────────────────────────────────────────
import { GLAZES } from './glazes-data.js';
import { saveAll } from './persistence.js';
import { glazeCSS } from './render.js';

// ── Module state ───────────────────────────────────────────────────────────────
let _key        = null;
let _stops      = [];
let _drag       = null;
let _nid        = 0;
let _allKeys    = [];
let _keyIdx     = -1;
let _navigating = false;
let _swipeStartX = null, _swipeStartY = null;
let _gradMode   = 'linear';
let _noiseOn    = false;

const MIN_W = 6;

function mkStop(name, hex, w) { return {id: _nid++, name, hex, weight: w}; }
function isMobile() { return window.innerWidth <= 700; }

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
    el.querySelector('.pd-block-fill').style.background = next.hex;
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

function _linearCss(arr) {
  if (arr.length === 1) return arr[0].hex;
  const ws = _weights(arr); let pct = 0;
  const pts = arr.map((s,i) => { const st=pct; pct+=ws[i]*100; return `${s.hex} ${((st+pct)/2).toFixed(1)}%`; });
  return `linear-gradient(to bottom,${pts.join(',')})`;
}

function _radialCss(arr) {
  if (arr.length === 1) return arr[0].hex;
  const ws = _weights(arr); let pct = 0;
  const pts = arr.map((s,i) => { const st=pct; pct+=ws[i]*100; return `${s.hex} ${((st+pct)/2).toFixed(1)}%`; });
  // Shift center left on desktop to account for 280px stops panel
  const cx = isMobile() ? '50%' : 'calc(50% - 140px)';
  return `radial-gradient(ellipse at ${cx} 50%,${pts.join(',')})`;
}

function _conicCss(arr) {
  if (arr.length === 1) return arr[0].hex;
  const ws = _weights(arr); let deg = 0;
  const pts = arr.map((s,i) => { const st=deg; deg+=ws[i]*360; return `${s.hex} ${st.toFixed(1)}deg ${deg.toFixed(1)}deg`; });
  const cx = isMobile() ? '50%' : 'calc(50% - 140px)';
  return `conic-gradient(from -90deg at ${cx} 50%,${pts.join(',')})`;
}

function _stripesCss(arr) {
  if (arr.length === 1) return arr[0].hex;
  const ws = _weights(arr); let pct = 0;
  const pts = [];
  arr.forEach((s,i) => { const st=pct; pct+=ws[i]*100; pts.push(`${s.hex} ${st.toFixed(1)}%`,`${s.hex} ${pct.toFixed(1)}%`); });
  return `linear-gradient(to bottom,${pts.join(',')})`;
}

function _turrellSVG(arr) {
  if (!arr.length) return '';
  const n = arr.length;
  const step = 45 / n;
  const rects = arr.map((s,i) => {
    const m = (i * step).toFixed(2);
    const sz = (100 - 2 * parseFloat(m)).toFixed(2);
    return `<rect x="${m}%" y="${m}%" width="${sz}%" height="${sz}%" fill="${s.hex}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block;position:absolute;inset:0">${rects.join('')}</svg>`;
}

// ── Gradient background renderer ───────────────────────────────────────────────
function renderGradBg(arr) {
  const el      = document.getElementById('pdGradient');
  const canvas  = document.getElementById('pdCanvas');
  const noiseEl = document.getElementById('pdNoiseOverlay');
  if (!el) return;

  // Canvas bg = first stop hue so blur edges don't bleed white
  if (canvas && arr.length) canvas.style.backgroundColor = arr[0].hex;

  // Noise overlay always synced regardless of mode
  if (noiseEl) noiseEl.style.opacity = _noiseOn ? '1' : '0';

  if (_gradMode === 'turrell') {
    // Soft blur = Josef Albers squares of light, not harsh Albers hard-edge
    el.style.background = arr.length ? arr[0].hex : 'var(--surf)';
    el.style.filter     = 'blur(18px) saturate(0.9)';
    el.style.transform  = 'scale(1.12)';
    el.innerHTML        = _turrellSVG(arr);
    return;
  }

  el.innerHTML = '';

  if (_gradMode === 'conic') {
    // Less blur for conic so wedge structure reads; centered on visible area
    el.style.filter    = 'blur(28px) saturate(1.4)';
    el.style.transform = 'scale(1.18)';
    el.style.background = _conicCss(arr);
  } else if (_gradMode === 'radial') {
    el.style.filter    = 'blur(60px) saturate(1.1)';
    el.style.transform = 'scale(1.18)';
    el.style.background = _radialCss(arr);
  } else if (_gradMode === 'stripes') {
    el.style.filter    = 'blur(2px)';
    el.style.transform = '';
    el.style.background = _stripesCss(arr);
  } else {
    el.style.filter    = 'blur(60px) saturate(1.1)';
    el.style.transform = 'scale(1.18)';
    el.style.background = _linearCss(arr);
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
  const m = likedMeta.find(x => x.key === _key);
  if (!m) return;
  m.names = _stops.map(s => s.name);
  m.hexes = _stops.map(s => s.hex);
  saveAll();
  const gs = _stops.map(s => GLAZES.find(g => g.name === s.name)).filter(Boolean);
  const css = gs.length ? glazeCSS(gs, clayKey) : '';
  document.querySelectorAll(`.lchip[data-key="${_key}"] .lchip-strip`).forEach(el => { if (css) el.style.background = css; });
  document.querySelectorAll(`.lchip[data-key="${_key}"] .lchip-glazes`).forEach(el => { el.textContent = m.names.join(', '); });
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
}

function updatePinBadge() {
  const badge = document.getElementById('pdPinBadge');
  if (!badge) return;
  const m = likedMeta.find(x => x.key === _key);
  badge.textContent = m ? '♥ Saved' : '○ Unsaved';
  badge.classList.toggle('is-saved', !!m);
}

// ── Load data ──────────────────────────────────────────────────────────────────
function _loadKeyData(key) {
  _key = key;
  const m = likedMeta.find(x => x.key === key);
  if (!m) return;
  _stops = [];
  const names = m.names || [];
  const hexes = m.hexes  || [];
  const w = names.length ? 100 / names.length : 100;
  names.forEach((name, i) => {
    const hex = hexes[i] || (GLAZES.find(g => g.name === name)?.hex) || '#888';
    _stops.push(mkStop(name, hex, w));
  });
  const title = document.getElementById('pdTitle');
  if (title) title.value = (typeof labelStore !== 'undefined' ? labelStore[key] : null) || m.label || 'Palette';
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
  _gradMode = mode;
  updateModeBar();
  renderGradBg(_stops);
}

export function pdToggleNoise() {
  _noiseOn = !_noiseOn;
  updateModeBar();
  const noiseEl = document.getElementById('pdNoiseOverlay');
  if (noiseEl) noiseEl.style.opacity = _noiseOn ? '1' : '0';
}

// ── Keyboard / swipe ───────────────────────────────────────────────────────────
function _onKeyDown(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pdNext(); }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); pdPrev(); }
  if (e.key === 'Escape') closePaletteDetail();
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
  if (!container || !panel) return;

  const mobile  = isMobile();
  const panelSz = mobile ? panel.offsetWidth : panel.offsetHeight;

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
        <div class="pd-block-fill" style="background:${s.hex}"></div>
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
  renderPickerHighlights();
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
export function openPaletteDetail(key) {
  _allKeys = likedMeta.map(m => m.key);
  _keyIdx  = _allKeys.indexOf(key);
  if (_keyIdx === -1) { _allKeys = [key]; _keyIdx = 0; }
  _nid = 0; _drag = null;

  document.getElementById('paletteDetail').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  _loadKeyData(key);
  updateNav();
  updateModeBar();
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
  document.getElementById('paletteDetail').style.display = 'none';
  document.body.style.overflow = '';
  window.removeEventListener('resize', render);
  document.removeEventListener('keydown', _onKeyDown);
  const grad = document.getElementById('pdGradient');
  if (grad) {
    grad.removeEventListener('touchstart', _onSwipeStart);
    grad.removeEventListener('touchend',   _onSwipeEnd);
  }
  _key = null; _stops = []; _drag = null; _allKeys = []; _keyIdx = -1; _navigating = false;
  _gradMode = 'linear'; _noiseOn = false;
}
