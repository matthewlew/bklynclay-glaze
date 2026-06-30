import { state } from './state.js';
import { NL } from './glazes-data.js';

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

// ── INDEXEDDB PERSISTENCE ──────────────────────────────────────────────────────
const DB_NAME = 'bklyn_glaze_db';
const DB_VERSION = 1;
const STORE_NAME = 'state_store';
const KEY_NAME = 'bklyn_v6_state';

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
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME);
      }
    };
  });
}

function getDBState() {
  return new Promise((resolve) => {
    if (useLocalStorageFallback || !db) {
      resolve(null);
      return;
    }
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(KEY_NAME);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result || null);
    } catch (e) {
      resolve(null);
    }
  });
}

function setDBState(data) {
  return new Promise((resolve, reject) => {
    if (useLocalStorageFallback || !db) {
      reject(new Error("No DB"));
      return;
    }
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, KEY_NAME);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export async function saveAll() {
  const rankState = state.rankMode === 'done' ? { sorted: state.rankSorted.map(m => m.key), mode: 'done' } : null;
  const data = {
    keys: [...state.likedKeys],
    meta: state.likedMeta,
    projects: state.projects,
    labels: state.labelStore,
    rankState,
    pairs: state.compPairs,
    learnedWeights: state.learnedWeights
  };

  let success = false;
  if (db && !useLocalStorageFallback) {
    try {
      await setDBState(data);
      success = true;
    } catch (e) {
      console.error("IndexedDB write failed:", e);
      window.showToast?.('Local database error — falling back to local storage.');
    }
  }

  // Fallback to localStorage if DB unavailable
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
}

export async function loadAll() {
  await openDB();

  let data = null;
  let migrated = false;

  const localDataStr = localStorage.getItem('bklyn_v6');

  if (db && !useLocalStorageFallback) {
    data = await getDBState();
    if (!data && localDataStr) {
      // Perform one-time migration
      try {
        data = JSON.parse(localDataStr);
        await setDBState(data);
        localStorage.removeItem('bklyn_v6');
        migrated = true;
        console.log("Successfully migrated localStorage to IndexedDB.");
      } catch (err) {
        console.error("Migration failed:", err);
      }
    }
  }

  if (!data && localDataStr) {
    try {
      data = JSON.parse(localDataStr);
    } catch (e) {
      console.error("Failed to parse localStorage fallback data:", e);
    }
  }

  if (useLocalStorageFallback) {
    setTimeout(() => {
      window.showToast?.('Warning: Storage is limited. Private browsing/incognito may restrict IndexedDB.');
    }, 1000);
  }

  if (data) {
    state.likedKeys = new Set(data.keys || []);
    state.likedMeta = data.meta || [];
    state.projects = data.projects || [];
    state.labelStore = data.labels || {};
    if (data.rankState && data.rankState.mode === 'done') {
      state.rankMode = 'done';
      state.rankSorted = (data.rankState.sorted || []).map(k => state.likedMeta.find(m => m.key === k)).filter(Boolean);
    }
    state.compPairs = data.pairs || [];
    state.learnedWeights = data.learnedWeights || null;
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
    pairs: state.compPairs,
    learnedWeights: state.learnedWeights
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
