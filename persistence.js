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
export function generatePaletteName(glazes) {
  if (!glazes || glazes.length === 0) return 'Palette';
  const names = glazes.map(g => typeof g === 'string' ? g : g.name).filter(Boolean);
  if (names.length === 0) return 'Palette';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  const firsts = names.slice(0, -1).join(', ');
  return `${firsts} + ${names[names.length - 1]}`;
}

export function tokenize(raw) {
  return raw.replace(/\band\b/gi,',').split(/[\n,+&]+/).map(t=>t.trim()).filter(t=>t.length>0&&!t.startsWith('#'));
}

export function lookupGlaze(tok) {
  const lc=tok.trim().toLowerCase();
  
  // Check if token matches a hex color code (e.g. #FF5733 or FF5733)
  const hexMatch = lc.match(/^#?([0-9a-f]{6})$/);
  if (hexMatch) {
    const hex = '#' + hexMatch[1];
    // Try exact hex match
    const exact = NL.find(x => x.g.hex.toLowerCase() === hex);
    if (exact) return exact;
    
    // Find closest glaze using Euclidean distance in RGB space
    const r = parseInt(hexMatch[1].slice(0, 2), 16);
    const g = parseInt(hexMatch[1].slice(2, 4), 16);
    const b = parseInt(hexMatch[1].slice(4, 6), 16);
    
    let closest = null, minDist = Infinity;
    NL.forEach(x => {
      const gh = x.g.hex.replace('#', '');
      const gr = parseInt(gh.slice(0, 2), 16);
      const gg = parseInt(gh.slice(2, 4), 16);
      const gb = parseInt(gh.slice(4, 6), 16);
      const dist = Math.pow(r - gr, 2) + Math.pow(g - gg, 2) + Math.pow(b - gb, 2);
      if (dist < minDist) {
        minDist = dist;
        closest = x;
      }
    });
    return closest;
  }

  return NL.find(x=>x.lc===lc)||NL.find(x=>x.lc.startsWith(lc))||NL.find(x=>x.lc.includes(lc));
}

export function parseGlazeTokens(raw) {
  const tokens=tokenize(raw),found=[],unknown=[];
  tokens.forEach(tok=>{const m=lookupGlaze(tok);if(m)found.push(m.g);else if(/[a-zA-Z]/.test(tok))unknown.push(tok);});
  return{found,unknown};
}

export function parseBlocks(raw) {
  return raw.split(/\n\s*\n/).filter(b=>b.trim()).map(block=>{
    const lines=block.trim().split('\n');let label='',body=lines;
    const hasHeader = lines[0].trim().startsWith('#');
    if(hasHeader){label=lines[0].trim().slice(1).trim();body=lines.slice(1);}
    const{found}=parseGlazeTokens(body.join('\n'));
    if(!label){label=generatePaletteName(found);}
    return{label,glazes:found};
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
    try {
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
    } catch (err) {
      console.warn("IndexedDB open threw an error, falling back:", err);
      useLocalStorageFallback = true;
      resolve(null);
    }
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
        try {
          const trans = db.transaction(['labels'], 'readonly');
          trans.onerror = () => resolve();
          const store = trans.objectStore('labels');
          const request = store.openCursor();
          request.onerror = () => resolve();
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              labels[cursor.key] = cursor.value;
              cursor.continue();
            } else {
              resolve();
            }
          };
        } catch (err) {
          console.warn("Labels IndexedDB transaction failed:", err);
          resolve();
        }
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

export function doImport(rawText) {
  let raw = typeof rawText === 'string' ? rawText.trim() : '';
  if (!raw && document.getElementById('importText')) {
    raw = document.getElementById('importText').value.trim();
  }
  if (!raw) return;

  try {
    const d = JSON.parse(raw);
    
    // 1. Relational DB restore format
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

    // 2. Custom JSON Palette / Array of Palettes format
    const isPaletteObj = (obj) => obj && typeof obj === 'object' && (Array.isArray(obj.names) || Array.isArray(obj.glazes) || Array.isArray(obj.glazeNames));
    let importedPalettes = [];
    if (isPaletteObj(d)) {
      importedPalettes.push(d);
    } else if (Array.isArray(d) && d.every(isPaletteObj)) {
      importedPalettes = d;
    }

    if (importedPalettes.length > 0) {
      let count = 0;
      let namesList = [];
      importedPalettes.forEach(p => {
        const glazeNames = p.names || p.glazes || p.glazeNames;
        const glazesList = glazeNames.map(name => {
          if (typeof name === 'string') {
            return lookupGlaze(name)?.g;
          } else if (name && typeof name === 'object') {
            return lookupGlaze(name.name || name.hex)?.g;
          }
          return null;
        }).filter(Boolean);

        if (glazesList.length >= 2) {
          const key = glazesList.map(g => g.name).join('|');
          const label = p.label || p.title || generatePaletteName(glazesList);
          if (!state.likedMeta.find(m => m.key === key)) {
            state.likedKeys.add(key);
            state.likedMeta.push({
              key,
              label,
              feeling: p.feeling || '',
              tag: p.tag || 'Imported',
              names: glazesList.map(g => g.name),
              hexes: glazesList.map(g => g.hex),
              projectId: state.activeContext !== 'global' ? state.activeContext : undefined
            });
            count++;
            namesList.push(label);
          }
        }
      });

      if (count > 0) {
        saveAll();
        window.renderSidebar?.();
        window.closeImport?.();
        window.showToast?.(`Imported ${count} palette${count > 1 ? 's' : ''}: ${namesList.join(', ')}`);
        return;
      } else {
        window.showToast?.('Palettes already exist.');
        window.closeImport?.();
        return;
      }
    }
    
    // 3. Generic color arrays/tokens (Figma, Adobe Color, etc.)
    let colors = [];
    let label = 'Imported JSON';
    
    // Adobe Color (Kuler) Theme JSON: { "title": "...", "colors": [{ "hex": "..." }] }
    if (d.colors && Array.isArray(d.colors)) {
      colors = d.colors;
      if (d.title) label = d.title.trim();
    }
    // Adobe Color flat array of colors: [ { "hex": "..." }, ... ] or array of hexes: [ "#ff0000", ... ]
    else if (Array.isArray(d)) {
      colors = d;
    }
    // Nested object tokens (Figma Design Tokens / Tokens Studio format)
    else {
      const extractColors = (obj) => {
        let found = [];
        for (let k in obj) {
          if (obj[k] && typeof obj[k] === 'object') {
            if (obj[k].value && typeof obj[k].value === 'string' && obj[k].value.startsWith('#')) {
              found.push({ hex: obj[k].value, name: k });
            } else if (obj[k].$value && typeof obj[k].$value === 'string' && obj[k].$value.startsWith('#')) {
              found.push({ hex: obj[k].$value, name: k });
            } else {
              found = found.concat(extractColors(obj[k]));
            }
          } else if (typeof obj[k] === 'string' && obj[k].startsWith('#') && obj[k].length === 7) {
            found.push({ hex: obj[k], name: k });
          }
        }
        return found;
      };
      colors = extractColors(d);
    }
    
    if (colors.length >= 2) {
      const foundGlazes = [];
      colors.forEach(c => {
        let hex = null;
        if (typeof c === 'string') {
          hex = c;
        } else if (c && typeof c === 'object') {
          hex = c.hex || c.value || c.$value;
        }
        
        if (hex && typeof hex === 'string') {
          const match = lookupGlaze(hex);
          if (match && !foundGlazes.find(fg => fg.name === match.g.name)) {
            foundGlazes.push(match.g);
          }
        }
      });
      
      if (foundGlazes.length >= 2) {
        if (label === 'Imported JSON') {
          label = generatePaletteName(foundGlazes);
        }
        const key = foundGlazes.map(g => g.name).join('|');
        if (!state.likedMeta.find(m => m.key === key)) {
          state.likedKeys.add(key);
          state.likedMeta.push({
            key,
            label,
            feeling: '',
            tag: 'Imported',
            names: foundGlazes.map(g => g.name),
            hexes: foundGlazes.map(g => g.hex),
            projectId: state.activeContext !== 'global' ? state.activeContext : undefined
          });
          saveAll();
          window.renderSidebar?.();
          window.closeImport?.();
          window.showToast?.(`Imported palette: "${label}" (${foundGlazes.map(g => g.name).join(', ')})`);
          return;
        } else {
          window.showToast?.('Palette already exists.');
          window.closeImport?.();
          return;
        }
      }
    }
  } catch (e) {}

  const blocks = parseBlocks(raw);
  let count = 0;
  let namesList = [];
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
      namesList.push(label);
    }
  });
  if (count > 0) {
    saveAll();
    window.renderSidebar?.();
    window.closeImport?.();
    window.showToast?.(`Imported ${count} palette${count > 1 ? 's' : ''}: ${namesList.join(', ')}`);
  } else {
    window.showToast?.(blocks.length ? 'Palettes already exist.' : 'No new palettes found.');
    window.closeImport?.();
  }
}
