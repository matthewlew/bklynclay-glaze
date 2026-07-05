import { test, expect } from '@playwright/test';

test.describe('Flow mode shell', () => {
  test('Flow button opens the overlay; ✕ and Esc close it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    const overlay = page.locator('#flowView');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#flowStyleName')).toHaveText('LINEAR');
    // 5 style dots, first one active
    await expect(page.locator('#flowDots span')).toHaveCount(5);
    await expect(page.locator('#flowDots span.on')).toHaveCount(1);
    await page.locator('#flowClose').click();
    await expect(overlay).toBeHidden();
    await page.locator('#flowBtn').click();
    await expect(overlay).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });
});
