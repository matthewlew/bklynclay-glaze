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
