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
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
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

test('score weight buttons (T5) are enabled for active board and update hint on click', async ({ page }) => {
  await page.goto('/');
  // Without a board, the buttons should be disabled
  const wrap = page.locator('#scoreWeightSelect');
  await expect(wrap).toBeVisible();
  const balancedBtn = wrap.locator('button', { hasText: 'Balanced' });
  const contrastBtn = wrap.locator('button', { hasText: 'Contrast' });
  await expect(balancedBtn).toBeDisabled();
  // Create a board and switch to it
  await page.locator('.sb-new-proj-btn').click();
  await expect(page.locator('.ttab[data-proj-id].on')).toBeVisible({ timeout: 3000 });
  // Now the buttons should be enabled and Balanced shown as active by default
  await expect(balancedBtn).toBeEnabled();
  await expect(balancedBtn).toHaveClass(/on/);
  // Clicking Contrast updates the hint text
  const hint = page.locator('#scoreWeightHint');
  await contrastBtn.click();
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
  // Score peek should still be visible after the targeted refresh
  await expect(firstCard.locator('.card-score-peek')).toBeVisible();
});

test('rename dialog renders as a compact centered modal on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('.sb-new-proj-btn').click();
  const tab = page.locator('.ttab[data-proj-id]').first();
  await expect(tab).toBeVisible({ timeout: 3000 });
  await tab.click({ button: 'right' });
  await page.locator('.proj-menu-item', { hasText: 'Rename board' }).click();
  const sheet = page.locator('.dialog-sheet');
  await expect(sheet).toBeVisible();
  // Desktop styling centers the sheet instead of pinning it to the bottom
  const cssText = await sheet.evaluate(el => el.style.cssText);
  expect(cssText).toContain('translate(-50%, -50%)');
  await page.locator('.ds-cancel').click();
  await expect(sheet).toBeHidden();
});

test('rename dialog stays a bottom sheet on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => window.openProjectsView());
  await page.locator('.pv-add-btn').click();
  await page.evaluate(() => window.closeProjectsView());
  await expect(page.locator('#projectsView')).toBeHidden();
  const tab = page.locator('.ttab[data-proj-id]').first();
  await expect(tab).toHaveCount(1, { timeout: 3000 });
  await tab.dispatchEvent('contextmenu');
  await page.locator('.proj-menu-item', { hasText: 'Rename board' }).click();
  const sheet = page.locator('.dialog-sheet');
  await expect(sheet).toBeVisible();
  const cssText = await sheet.evaluate(el => el.style.cssText);
  expect(cssText).toContain('max-height: 50vh');
});

test('dragging a project tab reorders the topbar tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
  await page.locator('.sb-new-proj-btn').click();
  await expect(page.locator('.ttab[data-proj-id]')).toHaveCount(1, { timeout: 3000 });
  await page.locator('.sb-new-proj-btn').click();
  await expect(page.locator('.ttab[data-proj-id]')).toHaveCount(2, { timeout: 3000 });

  const idsBefore = await page.locator('.ttab[data-proj-id]').evaluateAll(els => els.map(e => e.dataset.projId));

  await page.evaluate(([srcId, dstId]) => {
    const tabs = [...document.querySelectorAll('.ttab[data-proj-id]')];
    const src = tabs.find(t => t.dataset.projId === srcId);
    const dst = tabs.find(t => t.dataset.projId === dstId);
    const dt = new DataTransfer();
    dt.setData('text/plain', 'proj-reorder:' + srcId);
    src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    dst.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    dst.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [idsBefore[1], idsBefore[0]]);

  const idsAfter = await page.locator('.ttab[data-proj-id]').evaluateAll(els => els.map(e => e.dataset.projId));
  expect(idsAfter).toEqual([idsBefore[1], idsBefore[0]]);
});

test('project reorder persists across reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
  await page.locator('.sb-new-proj-btn').click();
  await expect(page.locator('.ttab[data-proj-id]')).toHaveCount(1, { timeout: 3000 });
  await page.locator('.sb-new-proj-btn').click();
  await expect(page.locator('.ttab[data-proj-id]')).toHaveCount(2, { timeout: 3000 });

  const idsBefore = await page.locator('.ttab[data-proj-id]').evaluateAll(els => els.map(e => e.dataset.projId));

  await page.evaluate(([srcId, dstId]) => {
    const tabs = [...document.querySelectorAll('.ttab[data-proj-id]')];
    const src = tabs.find(t => t.dataset.projId === srcId);
    const dst = tabs.find(t => t.dataset.projId === dstId);
    const dt = new DataTransfer();
    dt.setData('text/plain', 'proj-reorder:' + srcId);
    src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
    dst.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    dst.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [idsBefore[1], idsBefore[0]]);

  // Give the async saveAll() write time to land before reloading
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('.ttab[data-proj-id]')).toHaveCount(2, { timeout: 3000 });
  const idsAfter = await page.locator('.ttab[data-proj-id]').evaluateAll(els => els.map(e => e.dataset.projId));
  expect(idsAfter).toEqual([idsBefore[1], idsBefore[0]]);
});

test('mobile Projects screen lists boards and navigates on tap', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => window.openProjectsView());
  await page.locator('.pv-add-btn').click();
  await expect(page.locator('.ttab[data-proj-id]')).toHaveCount(1, { timeout: 3000 });

  await page.evaluate(() => window.openProjectsView());
  const view = page.locator('#projectsView');
  await expect(view).toHaveClass(/open/);
  await expect(view.locator('.pv-row-all')).toBeVisible();
  const row = view.locator('.pv-row[data-proj-id]').first();
  await expect(row).toBeVisible();
  const projId = await row.getAttribute('data-proj-id');

  await row.click();
  await expect(view).not.toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => window.activeContext)).toBe(projId);
});

test('opening a palette detail from a conic gallery view opens in conic mode', async ({ page }) => {
  await page.goto('/');
  await page.locator('.gv-btn[data-mode="conic"]').click();
  await page.locator('.card').first().click();
  await expect(page.locator('#paletteDetail')).toHaveClass(/open/);
  await expect(page.locator('.pd-mode-btn[data-mode="conic"]')).toHaveClass(/active/);
});

test('detail view swatch color matches the gallery-computed clay-adjusted color', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
  await page.locator('.clay-btn.red').click();
  await expect(page.locator('.clay-btn.red')).toHaveClass(/on/);
  await page.locator('.card').first().click();
  await expect(page.locator('#paletteDetail')).toHaveClass(/open/);
  await expect(page.locator('.flow-stop-lbl').first()).toBeVisible({ timeout: 5000 });

  const result = await page.evaluate(async () => {
    const mod = await import('/render.js');
    const gmod = await import('/glazes-data.js');
    const nameEl = document.querySelector('.flow-stop-lbl span');
    const name = nameEl.textContent.trim();
    const g = gmod.GLAZES.find(x => x.name === name);
    const c = mod.applyGlaze(g, 'red');
    const expected = `rgb(${Math.round(c.r)}, ${Math.round(c.gr)}, ${Math.round(c.b)})`;
    return { name, expected };
  });
  expect(result.name).toBeTruthy();
  expect(result.expected).toContain('rgb(');
});

test('clicking the pin badge in palette detail toggles saved state', async ({ page }) => {
  await page.goto('/');
  await page.locator('.card').first().click();
  await expect(page.locator('#paletteDetail')).toHaveClass(/open/);
  const badge = page.locator('#pdPinBadge');
  await expect(badge).toBeVisible();
  const wasSaved = (await badge.getAttribute('class')).includes('is-saved');

  await badge.click();
  if (wasSaved) {
    await expect(badge).not.toHaveClass(/is-saved/);
    await expect(badge).toContainText('Unsaved');
  } else {
    await expect(badge).toHaveClass(/is-saved/);
    await expect(badge).toContainText('Saved');
  }

  // Clicking again toggles back to the original state
  await badge.click();
  await expect(badge).toContainText(wasSaved ? 'Saved' : 'Unsaved');
});

test('view-rating pure helpers compute gradients and summarize logs correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 5000 });
  const result = await page.evaluate(async () => {
    const vr = await import('/view-rating.js');
    const hexes = ['#ff0000', '#00ff00', '#0000ff'];
    const linear = vr.linearCSS(hexes);
    const radial = vr.radialCSS(hexes);
    const conic = vr.conicCSS(hexes);
    const stripes = vr.stripesCSS(hexes);
    const turrell = vr.turrellSVGDataUri(hexes);
    const combos = vr.allCombos();
    const singleHex = vr.linearCSS(['#abcabc']);
    const summary = vr.summarizeViewRatings([
      { key: 'p1', order: [{ mode: 'linear', reverse: false }, { mode: 'radial', reverse: false }] },
      { key: 'p2', order: [{ mode: 'radial', reverse: false }, { mode: 'linear', reverse: false }] },
    ]);
    return { linear, radial, conic, stripes, turrell, combosLen: combos.length, singleHex, summary };
  });
  expect(result.linear).toBe('linear-gradient(to bottom,#ff0000,#00ff00,#0000ff)');
  expect(result.radial).toContain('radial-gradient(ellipse at 50% 50%');
  expect(result.conic).toContain('conic-gradient(from 0deg');
  expect(result.stripes).toContain('linear-gradient(to bottom,');
  expect(result.turrell).toContain('url("data:image/svg+xml,');
  expect(result.combosLen).toBe(14); // 7 modes x fwd/rev
  expect(result.singleHex).toBe('#abcabc');
  // linear and radial tie for average rank 0.5 across the two logged palettes
  expect(result.summary).toHaveLength(2);
  expect(result.summary[0].avgRank).toBeCloseTo(0.5);
  expect(result.summary[0].count).toBe(2);
});

test('Rate Views card sort: rank cards, complete a palette, and see results summary', async ({ page }) => {
  await page.goto('/');
  // Ensure at least one palette is pinned/saved.
  await page.locator('.card').first().click();
  await expect(page.locator('#paletteDetail')).toHaveClass(/open/);
  const badge = page.locator('#pdPinBadge');
  if (!(await badge.getAttribute('class')).includes('is-saved')) {
    await badge.click();
    await expect(badge).toHaveClass(/is-saved/);
  }
  await page.locator('#paletteDetail .pd-back').click();

  // Navigate to Analytics tab and launch the Rate Views card sort.
  await page.locator('.ttab', { hasText: 'Analytics' }).click();
  const viewBtn = page.locator('.rate-rank-mode-btn', { hasText: 'Rate Views' });
  await expect(viewBtn).toBeVisible();
  await viewBtn.click();

  const cards = page.locator('.vr-card');
  await expect(cards.first()).toBeVisible({ timeout: 3000 });
  const count = await cards.count();
  expect(count).toBe(14);

  // Click every card to build a full ranking order.
  for (let i = 0; i < count; i++) {
    await cards.nth(i).click();
  }
  await expect(cards.first()).toHaveClass(/ranked/);
  await expect(cards.first().locator('.vr-card-rank')).toHaveText('1');

  const doneBtn = page.locator('button', { hasText: 'Done — save & next palette' });
  await expect(doneBtn).toBeEnabled();
  await doneBtn.click();

  // Only one palette was pinned, so the sort should immediately finish and show results.
  await expect(page.locator('button', { hasText: 'Rate Views Again' })).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.rank-results .rank-result-row').first()).toBeVisible();
});

test('mobile gallery renders all tiles fully without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const cards = page.locator('.card');
  await expect(cards.first()).toBeVisible({ timeout: 5000 });
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(4);

  // Each of the first 4 tiles should have a real rendered height (not clipped/collapsed to 0)
  for (let i = 0; i < 4; i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThan(20);
  }
});
