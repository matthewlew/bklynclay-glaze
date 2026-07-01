import { test, expect } from '@playwright/test';

test('app loads with topbar and palette cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand')).toContainText('BklynClay');
  await expect(page.locator('.topbar')).toBeVisible();
  // Gallery renders at least one palette card
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
});

test('clay body toggle switches between White and Red', async ({ page }) => {
  await page.goto('/');
  const redBtn = page.locator('.clay-btn.red');
  await expect(redBtn).toBeVisible();
  await redBtn.click();
  await expect(redBtn).toHaveClass(/on/);
});

test('Discover and Analytics tabs are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ttab', { hasText: 'Explore' })).toBeVisible();
  await expect(page.locator('.ttab', { hasText: 'Analytics' })).toBeVisible();
});

test('scoring-explained doc page loads with expected title', async ({ page }) => {
  await page.goto('/docs/scoring-explained.html');
  await expect(page).toHaveTitle(/scoreAesthetic/);
  await expect(page.locator('.ds-page-title')).toBeVisible();
});

test('creating a board adds a topbar tab and switches context', async ({ page }) => {
  await page.goto('/');
  const newProjBtn = page.locator('.sb-new-proj-btn');
  await expect(newProjBtn).toBeVisible();
  await newProjBtn.click();
  // A new project tab with data-proj-id appears and becomes active
  const projTab = page.locator('.ttab[data-proj-id]').first();
  await expect(projTab).toBeVisible({ timeout: 3000 });
  await expect(projTab).toHaveClass(/on/);
});

test('score weight select (T5) is enabled for active board and updates hint on change', async ({ page }) => {
  await page.goto('/');
  // Without a board, the select should be disabled
  const sel = page.locator('#scoreWeightSelect');
  await expect(sel).toBeVisible();
  await expect(sel).toBeDisabled();
  // Create a board and switch to it
  await page.locator('.sb-new-proj-btn').click();
  await expect(page.locator('.ttab[data-proj-id].on')).toBeVisible({ timeout: 3000 });
  // Now the select should be enabled and show Balanced by default
  await expect(sel).toBeEnabled();
  await expect(sel).toHaveValue('Balanced');
  // Changing to Contrast updates the hint text
  const hint = page.locator('#scoreWeightHint');
  await sel.selectOption('Contrast');
  await expect(hint).toContainText('color pop');
});

test('clay toggle (T8) updates score badges in-place without full card rebuild', async ({ page }) => {
  await page.goto('/');
  // Wait for cards to render
  const firstCard = page.locator('.card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });
  // Mark the first card with a sentinel attribute so we can detect DOM recreation
  await page.evaluate(() => {
    const card = document.querySelector('.card');
    if (card) card.dataset.sentinel = 'yes';
  });
  // Toggle clay body to Red (triggers renderGallery via keysMatch fast path)
  await page.locator('.clay-btn.red').click();
  // The sentinel attribute should still be present — card was NOT rebuilt
  const sentinel = await page.evaluate(() => document.querySelector('.card')?.dataset.sentinel);
  expect(sentinel).toBe('yes');
  // Score badge should still be visible after the targeted refresh
  await expect(firstCard.locator('.score-badge')).toBeVisible();
});
