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
      histLen = await page.evaluate(() => window.flowHistory.length);
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

test.describe('Flow edit mode', () => {
  test('single tap opens edit handles; Esc exits to feed (not out of Flow)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    await page.locator('#flowFeed').click({ position: { x: 200, y: 400 } });
    // single-tap fires after the 250ms double-tap window
    const layer = page.locator('#flowEditLayer');
    await expect(layer).toBeVisible();
    const handles = page.locator('.flow-stop');
    expect(await handles.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.flow-stop-lbl').first()).toContainText('%');
    // + insert handles between stops
    expect(await page.locator('.flow-plus').count()).toBe(await handles.count() - 1);
    await page.keyboard.press('Escape');
    await expect(layer).toBeHidden();
    await expect(page.locator('#flowView')).toBeVisible(); // still in Flow
  });

  test('conic edit mode draws the ring axis', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    await page.keyboard.press('ArrowRight'); // radial
    await page.keyboard.press('ArrowRight'); // conic
    await page.locator('#flowFeed').click({ position: { x: 200, y: 400 } });
    await expect(page.locator('#flowEditLayer .flow-axis-ring')).toBeVisible();
  });
});

test.describe('Flow edit interactions', () => {
  async function openEdit(page) {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    await page.locator('#flowFeed').click({ position: { x: 200, y: 400 } });
    await expect(page.locator('#flowEditLayer')).toBeVisible();
  }

  test('dragging a handle along the axis changes its stop percentage', async ({ page }) => {
    await openEdit(page);
    const first = page.locator('.flow-stop').first();
    const before = await page.locator('.flow-stop-lbl .pctxt').first().textContent();
    const box = await first.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + 180, { steps: 8 });
    await page.mouse.up();
    const after = await page.locator('.flow-stop-lbl .pctxt').first().textContent();
    expect(after).not.toBe(before);
    // gradient rewritten with the new stop
    const bg = await page.locator('.flow-card[data-idx="0"]').evaluate(el => el.style.background);
    const num = parseFloat(after);
    const regex = new RegExp(num.toFixed(0) + '(\\.\\d)?%');
    expect(bg).toMatch(regex);
  });

  test('tapping + opens the glaze picker and picking inserts a stop', async ({ page }) => {
    await openEdit(page);
    const n = await page.locator('.flow-stop').count();
    await page.locator('.flow-plus').first().click();
    await expect(page.locator('#flowPicker')).toBeVisible();
    await page.locator('#flowPicker .flow-pick-row').first().click();
    await expect(page.locator('#flowPicker')).toBeHidden();
    await expect(page.locator('.flow-stop')).toHaveCount(n + 1);
  });

  test('tapping a label swaps that glaze via the picker', async ({ page }) => {
    await openEdit(page);
    const label = page.locator('.flow-stop-lbl span').first();
    const oldName = await label.textContent();
    await label.click();
    await expect(page.locator('#flowPicker')).toBeVisible();
    // pick a row with a different name
    const row = page.locator(`#flowPicker .flow-pick-row:not(:has-text("${oldName}"))`).first();
    const newName = await row.locator('.flow-pick-name').textContent();
    await row.click();
    await expect(page.locator('.flow-stop-lbl span').first()).toHaveText(newName);
  });

  test('dragging a handle far off the axis removes it (respecting min 2)', async ({ page }) => {
    await openEdit(page);
    const n = await page.locator('.flow-stop').count();
    const first = page.locator('.flow-stop').first();
    const box = await first.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 10, { steps: 8 });
    await page.mouse.up();
    if (n > 2) await expect(page.locator('.flow-stop')).toHaveCount(n - 1);
    else await expect(page.locator('.flow-stop')).toHaveCount(2); // snaps back at minimum
  });
});

test.describe('Flow save', () => {
  test('double-click saves to likedMeta with names+hexes and pulses', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    const before = await page.evaluate(() => likedMeta.length);
    await page.locator('#flowFeed').dblclick({ position: { x: 200, y: 400 } });
    await expect(page.locator('#flowPulse')).toHaveClass(/show/);
    const after = await page.evaluate(() => likedMeta.length);
    expect(after).toBe(before + 1);
    const meta = await page.evaluate(() => likedMeta[likedMeta.length - 1]);
    expect(meta.names.length).toBeGreaterThanOrEqual(2);
    expect(meta.key).toBe(meta.names.join('|'));
    // idempotent: saving again does not duplicate or unsave
    await page.waitForTimeout(400);
    await page.locator('#flowFeed').dblclick({ position: { x: 200, y: 400 } });
    expect(await page.evaluate(() => likedMeta.length)).toBe(after);
    // edit mode did NOT open from the double-click
    await expect(page.locator('#flowEditLayer')).toBeHidden();
  });
});

test.describe('Flow arc menu & keys', () => {
  test('long-press opens the arc menu; releasing on Riff replaces the palette', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    const keyBefore = await page.evaluate(() => window.flowHistory[0].key);
    await page.mouse.move(200, 500);
    await page.mouse.down();
    await page.waitForTimeout(550);
    await expect(page.locator('#flowArc')).toBeVisible();
    const riff = page.locator('#flowArc .flow-arc-btn[data-act="riff"]');
    const box = await riff.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.up();
    await expect(page.locator('#flowArc')).toBeHidden();
    const keyAfter = await page.evaluate(() => window.flowHistory[0].key);
    expect(keyAfter).not.toBe(keyBefore);
  });

  test('releasing outside the arc cancels; S key saves', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#flowBtn').click();
    await page.mouse.move(200, 500);
    await page.mouse.down();
    await page.waitForTimeout(550);
    await expect(page.locator('#flowArc')).toBeVisible();
    await page.mouse.move(200, 200);
    await page.mouse.up();
    await expect(page.locator('#flowArc')).toBeHidden();
    const before = await page.evaluate(() => likedMeta.length);
    await page.keyboard.press('s');
    expect(await page.evaluate(() => likedMeta.length)).toBe(before + 1);
  });
});

test('Flow renders on red clay without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
  await page.locator('.clay-btn.red').click();
  await page.locator('#flowBtn').click();
  await expect(page.locator('#flowView')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight'); // conic — aperture must take red clay color
  const apBg = await page.locator('.flow-card[data-idx="0"] .conic-aperture')
    .evaluate(el => el.style.background);
  expect(apBg).not.toBe('');
  expect(errors).toEqual([]);
});
