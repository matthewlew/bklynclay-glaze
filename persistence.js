import { state } from './state.js';
import { NL } from './glazes-data.js';

// ── DIRTY-STATE TRACKING (for update-banner.js's multi-tab reload guard) ──────
// Two sources of "unsaved work in this tab": a focused text input/textarea
// (typing a name/edit that hasn't blurred/saved yet) and an in-flight
// saveAll() write. Kept intentionally simple — a coarse guard is enough to
// stop an unprompted reload from clobbering something the user is mid-typing.
let _dirty = false;
export function isDirty() { return _dirty; }

if (typeof document !== 'undefined') {
  document.addEventListener('focusin', e => {
    if (e.target?.matches?.('input, textarea, [contenteditable="true"]')) _dirty = true;
  });
  document.addEventListener('focusout', e => {
    if (e.target?.matches?.('input, textarea, [contenteditable="true"]')) _dirty = false;
  });
}

// ── PARSER ────────────────────────────────────────────────────────────────────
export function tokenize(raw) {
  return raw.replace(/\band\b/gi,',').split(/[\n,+&]+/).map(t=>t.trim()).filter(t=>t.length>0&&!t.startsWith('#'));
}

export function lookupGlaze(tok) {
  const lc=tok.toLowerCase();
  return NL.find(x=>x.lc===lc)||NL.find(x=>x.lc.startsWith(lc))||NL.find(x=>x.lc.includes(lc));
}

export function parseGlazeTokens(raw) {
  const tokens=tokenize(raw),found=[],unknown=[];
  tokens.forEach(tok=>{const m=lookupGlaze(tok);if(m)found.push(m.g);else if(/[a-zA-Z]/.test(tok))unknown.push(tok);});
  return{found,unknown};
}

export function parseBlocks(raw) {
  return raw.split(/\n\s*\n/).filter(b=>b.trim()).map(block=>{
    const lines=block.trim().split('\n');let label='Imported',body=lines;
    if(lines[0].trim().startsWith('#')){label=lines[0].trim().slice(1).trim();body=lines.slice(1);}
    const{found}=parseGlazeTokens(body.join('\n'));return{label,glazes:found};
  }).filter(b=>b.glazes.length>=2);
}

// ── RELATIONAL INDEXEDDB PERSISTENCE ──────────────────────────────────────────
const DB_NAME = 'bklyn_glaze_db';
const DB_VERSION = 1;
const STORES = ['projects', 'palettes', 'labels', 'config'];

let db = null;
let useLocalStorageFallback = false;

function openDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn("IndexedDB not supported by this browser.");
      useLocalStorageFallback = true;
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => {
      console.error("IndexedDB error:", e);
      useLocalStorageFallback = true;
      resolve(null);
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      STORES.forEach(s => {
        if (!dbInstance.objectStoreNames.contains(s)) {
          dbInstance.createObjectStore(s);
        }
      });
    };
  });
}

export async function saveAll() {
  _dirty = true;
  const rankState = state.rankMode === 'done' ? { sorted: state.rankSorted.map(m => m.key), mode: 'done' } : null;
  const data = {
    keys: [...state.likedKeys],
    meta: state.likedMeta,
    projects: state.projects,
    labels: state.labelStore,
    rankState,
    viewPrefs: state.viewPrefs,
    viewRatingLog: state.viewRatingLog
  };

  let success = false;
  if (db && !useLocalStorageFallback) {
    try {
      const transaction = db.transaction(STORES, 'readwrite');
      
      // 1. Save projects
      const projStore = transaction.objectStore('projects');
      projStore.clear();
      state.projects.forEach(p => projStore.put(p, p.id));
      
      // 2. Save palettes
      const palStore = transaction.objectStore('palettes');
      palStore.clear();
      state.likedMeta.forEach(m => palStore.put(m, m.key));
      
      // 3. Save labels
      const labelStoreDb = transaction.objectStore('labels');
      labelStoreDb.clear();
      Object.entries(state.labelStore).forEach(([k, v]) => labelStoreDb.put(v, k));
      
      // 4. Save config parameters
      const configStore = transaction.objectStore('config');
      configStore.put([...state.likedKeys], 'likedKeys');
      configStore.put(rankState, 'rankState');
      configStore.put(state.viewPrefs, 'viewPrefs');
      configStore.put(state.viewRatingLog, 'viewRatingLog');

      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      success = true;
    } catch (e) {
      console.error("IndexedDB write failed:", e);
      window.showToast?.('Local database error — falling back to local storage.');
    }
  }

  // Fallback to localStorage if IndexedDB fails
  if (!success) {
    try {
      localStorage.setItem('bklyn_v6', JSON.stringify(data));
      success = true;
    } catch (e) {
      window.showToast?.('Storage full — auto-saving backup…');
      setTimeout(() => exportSession(), 400);
    }
  }

  const f = document.getElementById('flash');
  if (f) {
    f.style.display = '';
    setTimeout(() => f.style.display = 'none', 1100);
  }
  window.updateCount?.();
  _dirty = false;
}

export async function loadAll() {
  await openDB();

  let loadedData = null;
  let migrated = false;
  const localDataStr = localStorage.getItem('bklyn_v6');

  if (db && !useLocalStorageFallback) {
    try {
      const transaction = db.transaction(STORES, 'readonly');
      const projRequest = transaction.objectStore('projects').getAll();
      const palRequest = transaction.objectStore('palettes').getAll();
      const keysRequest = transaction.objectStore('config').get('likedKeys');
      const rankRequest = transaction.objectStore('config').get('rankState');
      const viewPrefsRequest = transaction.objectStore('config').get('viewPrefs');
      const viewRatingLogRequest = transaction.objectStore('config').get('viewRatingLog');

      const allResult = await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve({
          projects: projRequest.result || [],
          palettes: palRequest.result || [],
          keys: keysRequest.result || [],
          rankState: rankRequest.result || null,
          viewPrefs: viewPrefsRequest.result || null,
          viewRatingLog: viewRatingLogRequest.result || null
        });
        transaction.onerror = () => reject(transaction.error);
      });

      // Load labels manually using a cursor
      const labels = {};
      await new Promise((resolve) => {
        const trans = db.transaction(['labels'], 'readonly');
        const store = trans.objectStore('labels');
        store.openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            labels[cursor.key] = cursor.value;
            cursor.continue();
          } else {
            resolve();
          }
        };
      });

      if (allResult.palettes.length > 0 || allResult.projects.length > 0) {
        loadedData = {
          keys: allResult.keys,
          meta: allResult.palettes,
          projects: allResult.projects,
          labels: labels,
          rankState: allResult.rankState,
          viewPrefs: allResult.viewPrefs,
          viewRatingLog: allResult.viewRatingLog
        };
      }
    } catch (e) {
      console.error("Failed to load from IndexedDB stores:", e);
    }

    // One-time migration from localStorage
    if (!loadedData && localDataStr) {
      try {
        const d = JSON.parse(localDataStr);
        const transaction = db.transaction(STORES, 'readwrite');
        
        const projStore = transaction.objectStore('projects');
        (d.projects || []).forEach(p => projStore.put(p, p.id));
        
        const palStore = transaction.objectStore('palettes');
        (d.meta || []).forEach(m => palStore.put(m, m.key));
        
        const labelStoreDb = transaction.objectStore('labels');
        Object.entries(d.labels || {}).forEach(([k, v]) => labelStoreDb.put(v, k));
        
        const configStore = transaction.objectStore('config');
        configStore.put(d.keys || [], 'likedKeys');
        if (d.rankState) configStore.put(d.rankState, 'rankState');
        if (d.viewPrefs) configStore.put(d.viewPrefs, 'viewPrefs');
        if (d.viewRatingLog) configStore.put(d.viewRatingLog, 'viewRatingLog');

        await new Promise((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });

        loadedData = d;
        localStorage.removeItem('bklyn_v6');
        migrated = true;
        console.log("Successfully migrated localStorage to relational IndexedDB stores.");
      } catch (err) {
        console.error("Migration failed:", err);
      }
    }
  }

  // Load from localStorage fallback if database is not active
  if (!loadedData && localDataStr) {
    try {
      loadedData = JSON.parse(localDataStr);
    } catch (e) {
      console.error("Failed to parse localStorage fallback data:", e);
    }
  }

  if (useLocalStorageFallback) {
    setTimeout(() => {
      window.showToast?.('Warning: Storage is limited. Private browsing/incognito may restrict IndexedDB.');
    }, 1000);
  }

  if (loadedData) {
    state.likedKeys = new Set(loadedData.keys || []);
    state.likedMeta = loadedData.meta || [];
    // IndexedDB getAll() returns records in key order, not the user's custom
    // drag-reorder order, so re-sort by the explicit `order` stamp instead.
    state.projects = (loadedData.projects || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    state.labelStore = loadedData.labels || {};
    state.viewPrefs = loadedData.viewPrefs || {};
    state.viewRatingLog = loadedData.viewRatingLog || [];
    if (loadedData.rankState && loadedData.rankState.mode === 'done') {
      state.rankMode = 'done';
      state.rankSorted = (loadedData.rankState.sorted || []).map(k => state.likedMeta.find(m => m.key === k)).filter(Boolean);
    }
  }

  if (migrated) {
    setTimeout(() => {
      window.showToast?.('Successfully migrated data to secure local database.');
    }, 1200);
  }

  window.renderSidebar?.();
  window.renderTopbarTabs?.();
  window.updateCount?.();
}

export function copyText() {
  if (!state.likedMeta.length) {
    window.showToast?.('Nothing pinned yet.');
    return;
  }
  const txt = state.likedMeta.map(m => '# ' + (state.labelStore[m.key] || m.label) + '\n' + (m.names || []).join('\n')).join('\n\n');
  navigator.clipboard.writeText(txt)
    .then(() => window.showToast?.('Copied to clipboard.'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      window.showToast?.('Copied.');
    });
}

export function exportSession() {
  const rankState = state.rankMode === 'done' ? { sorted: state.rankSorted.map(m => m.key), mode: 'done' } : null;
  const data = {
    keys: [...state.likedKeys],
    meta: state.likedMeta,
    projects: state.projects,
    labels: state.labelStore,
    rankState,
    viewPrefs: state.viewPrefs,
    viewRatingLog: state.viewRatingLog
  };
  const txt = JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(txt)
    .then(() => window.showToast?.('Session copied to clipboard.'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      window.showToast?.('Session copied.');
    });
}

export function doImport() {
  const raw = document.getElementById('importText').value.trim();
  try {
    const d = JSON.parse(raw);
    if (d.meta && Array.isArray(d.meta)) {
      state.likedKeys = new Set(d.keys || []);
      state.likedMeta = d.meta || [];
      state.projects = d.projects || [];
      state.labelStore = d.labels || {};
      state.viewPrefs = d.viewPrefs || {};
      state.viewRatingLog = d.viewRatingLog || [];
      if (d.rankState && d.rankState.mode === 'done') {
        state.rankMode = 'done';
        state.rankSorted = (d.rankState.sorted || []).map(k => state.likedMeta.find(m => m.key === k)).filter(Boolean);
      }
      saveAll();
      window.renderSidebar?.();
      window.renderTopbarTabs?.();
      window.closeImport?.();
      window.showToast?.(`Session restored: ${state.likedMeta.length} palette${state.likedMeta.length !== 1 ? 's' : ''}, ${state.projects.length} project${state.projects.length !== 1 ? 's' : ''}.`);
      return;
    }
  } catch (e) {}

  const blocks = parseBlocks(raw);
  let count = 0;
  blocks.forEach(({ label, glazes }) => {
    const key = glazes.map(g => g.name).join('|');
    if (!state.likedMeta.find(m => m.key === key)) {
      state.likedKeys.add(key);
      state.likedMeta.push({
        key,
        label,
        feeling: '',
        tag: 'Imported',
        names: glazes.map(g => g.name),
        hexes: glazes.map(g => g.hex),
        projectId: state.activeContext !== 'global' ? state.activeContext : undefined
      });
      count++;
    }
  });
  saveAll();
  window.renderSidebar?.();
  window.closeImport?.();
  window.showToast?.(count ? `Imported ${count} palette${count > 1 ? 's' : ''}.` : 'No new palettes found.');
}
