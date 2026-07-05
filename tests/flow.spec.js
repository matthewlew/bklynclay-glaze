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

test.describe('Flow feed', () => {
  test('scrolling down generates palettes; scrolling back restores the same ones', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    const firstBg = await page.locator('.flow-card[data-idx="0"]').evaluate(el => el.style.background);
    // Overlay was just un-hidden; feed.clientHeight can still read 0 until
    // layout settles, which would make scrollTop = clientHeight*3 a no-op
    // (no scroll event fires, history never grows). Wait for a real height
    // before jumping 3 cards down via scrollTop.
    await page.waitForFunction(() => document.getElementById('flowFeed').clientHeight > 0);
    await page.evaluate(() => {
      const feed = document.getElementById('flowFeed');
      feed.scrollTop = feed.clientHeight * 3;
    });
    // Wait on the real signal (history grown past the lookahead), not DOM
    // attachment — card 3 is pre-mounted by the initial 6-card lookahead
    // before any scroll is processed, so toBeAttached() alone races ahead
    // of the actual scroll-triggered index update. Poll manually rather than
    // via page.waitForFunction(async () => ...): an async predicate that
    // dynamically imports the module can resolve truthy on its very first
    // poll (the pending Promise itself, before it settles), so it doesn't
    // reliably wait for the real value here.
    let histLen = 0;
    for (let i = 0; i < 20 && histLen < 9; i++) {
      histLen = await page.evaluate(async () => (await import('/flow-view.js')).flowHistory.length);
      if (histLen < 9) await page.waitForTimeout(50);
    }
    await expect(page.locator('.flow-card[data-idx="3"]')).toBeAttached();
    expect(histLen).toBeGreaterThanOrEqual(9); // 3 + 6 lookahead
    // back to top: card 0 must render the identical palette
    await page.evaluate(() => { document.getElementById('flowFeed').scrollTop = 0; });
    await page.waitForFunction(() => document.getElementById('flowFeed').scrollTop === 0);
    await expect(page.locator('.flow-card[data-idx="0"]')).toBeAttached();
    const backBg = await page.locator('.flow-card[data-idx="0"]').evaluate(el => el.style.background);
    expect(backBg).toBe(firstBg);
  });

  test('every card shows glaze names with swatch dots', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    const rows = page.locator('.flow-card[data-idx="0"] .flow-name-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    await expect(rows.first().locator('i')).toHaveCount(1);
  });
});

test.describe('Flow style switching', () => {
  test('ArrowRight/ArrowLeft cycle styles, update pill + dots, wrap around', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    await expect(page.locator('#flowStyleName')).toHaveText('LINEAR');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#flowStyleName')).toHaveText('RADIAL');
    const bg = await page.locator('.flow-card[data-idx="0"]').evaluate(el => el.style.background);
    expect(bg).toContain('radial-gradient');
    // conic gets the aperture
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#flowStyleName')).toHaveText('CONIC');
    await expect(page.locator('.flow-card[data-idx="0"] .conic-aperture')).toBeAttached();
    // wrap: two more rights = TURRELL, one more = LINEAR again
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#flowStyleName')).toHaveText('TURRELL');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#flowStyleName')).toHaveText('LINEAR');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#flowStyleName')).toHaveText('TURRELL');
    await expect(page.locator('#flowDots span.on')).toHaveCount(1);
  });
});
