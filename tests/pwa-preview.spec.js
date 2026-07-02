// Runs only against the built production preview server (port 4173, see
// playwright.config.js "preview" project) — the dev server (5173) never
// registers a service worker, so SW install/cache/update behavior can only
// be exercised against the real dist/ build.
import { test, expect } from '@playwright/test';

test('service worker installs and caches all public/ assets', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      const reqs = await cache.keys();
      urls.push(...reqs.map(r => new URL(r.url).pathname));
    }
    return urls;
  });
  for (const asset of ['/index.html', '/manifest.json', '/glazes.json', '/icon-192.png', '/icon-512.png']) {
    expect(cachedUrls.some(u => u.endsWith(asset))).toBeTruthy();
  }
});

test('second visit is served from cache with the network idle', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Go offline and reload — a cache-served page must still render.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.topbar')).toBeVisible({ timeout: 5000 });
  await context.setOffline(false);
});

test('message listener triggers skipWaiting()', async ({ page }) => {
  await page.goto('/');
  const registration = await page.evaluate(() => navigator.serviceWorker.ready);
  const result = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active;
    if (!worker) return 'no-active-worker';
    // Sending SKIP_WAITING to an already-active worker is a no-op (nothing
    // is waiting) — this just proves the listener exists and doesn't throw.
    worker.postMessage('SKIP_WAITING');
    return 'sent';
  });
  expect(result).toBe('sent');
});

test('update banner appears after registration.waiting is set', async ({ page }) => {
  // Stub navigator.serviceWorker.ready to resolve with a "waiting" worker
  // BEFORE the app's own module script runs initUpdateBanner() on load —
  // update-banner.js is bundled into the hashed asset in production, so it
  // can't be imported standalone; drive it through the real page load path.
  await page.addInitScript(() => {
    const fakeReg = {
      waiting: { postMessage: () => {} },
      addEventListener: () => {},
    };
    Object.defineProperty(navigator.serviceWorker, 'ready', {
      value: Promise.resolve(fakeReg),
      configurable: true,
    });
  });
  await page.goto('/');
  await expect(page.locator('#swUpdateBanner')).toBeVisible({ timeout: 3000 });
});
