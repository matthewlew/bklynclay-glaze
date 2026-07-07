import { isDirty } from './persistence.js';

// Surfaces a small "update available" banner when a new service worker has
// installed and is waiting to activate, and reloads the page once the user
// opts in. Guards against the multi-tab race: if a second tab's dirty-state
// flag is set (a focused input, or an in-flight save) when the OTHER tab's
// refresh triggers controllerchange here, defer the reload instead of
// yanking the page out from under unsaved work.
const BANNER_ID = 'swUpdateBanner';
let reloadPending = false;

function showBanner(onRefresh) {
  if (document.getElementById(BANNER_ID)) return;
  const el = document.createElement('div');
  el.id = BANNER_ID;
  el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:#1a1a1a;color:#fff;font:600 13px/1.4 -apple-system,system-ui,sans-serif;';
  el.innerHTML = `<span>Update available</span><button type="button" style="background:#e8c97a;color:#1a1a1a;border:0;border-radius:6px;padding:6px 12px;font:inherit;font-weight:700;cursor:pointer;">Refresh</button>`;
  el.querySelector('button').addEventListener('click', onRefresh);
  document.body.appendChild(el);
}

function hideBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

export function initUpdateBanner() {
  if (!('serviceWorker' in navigator)) return;

  let hasController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.ready.then(registration => {
    const notifyIfWaiting = () => {
      if (registration.waiting) {
        showBanner(() => {
          registration.waiting?.postMessage('SKIP_WAITING');
        });
      }
    };
    notifyIfWaiting();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          notifyIfWaiting();
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) {
      hasController = true;
      return;
    }
    if (reloadPending) return;
    if (isDirty()) {
      // Defer: don't yank the page mid-edit. Re-check shortly, and also
      // once the user finishes (focusout / next saveAll clears the flag).
      const retry = () => {
        if (isDirty()) { setTimeout(retry, 1500); return; }
        reloadPending = true;
        window.location.reload();
      };
      setTimeout(retry, 1500);
      return;
    }
    reloadPending = true;
    hideBanner();
    window.location.reload();
  });
}
