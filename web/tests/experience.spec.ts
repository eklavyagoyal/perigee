import { test, expect } from '@playwright/test';

test('website overlays follow the journey; motion and sound remain optional', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#descent')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('heading', { name: 'Every signal. In context.' })).toBeInViewport();
  await expect(page.locator('.site-header')).toBeInViewport();
  await expect(page.locator('#orbital-canvas')).toBeInViewport();
  await page.screenshot({ path: 'test-results/orbit-desktop.png' });
  await page.getByRole('button', { name: 'Atmospheric re-entry', exact: true }).click();
  await expect(page.locator('#descent')).toHaveAttribute('data-phase', '2');
  await expect(page.getByRole('heading', { name: 'Train the model. Test the claim.' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/reentry-desktop.png' });
  await page.getByRole('button', { name: 'Enable atmospheric sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute atmospheric sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mute atmospheric sound' }).click();
  await page.getByRole('button', { name: 'Pause ambient animation' }).click();
  await expect(page.getByRole('button', { name: 'Resume ambient animation' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Protect the mission', exact: true }).click();
  await expect(page.locator('#descent')).toHaveAttribute('data-phase', '4');
  await expect(page.getByRole('heading', { name: 'Make the next review clearer.' })).toBeVisible();
  await expect(page.locator('[data-chapter="0"]')).toHaveAttribute('inert', '');
  await page.screenshot({ path: 'test-results/final-desktop.png' });
  expect(errors).toEqual([]);
});

test('landing results match the checklist and disclose the stronger classical baseline', async ({ page }) => {
  await page.goto('/#evidence');
  const evidence = page.locator('#evidence');
  await expect(evidence.getByRole('heading', { name: 'A useful model starts with an honest comparison.' })).toBeVisible();
  const rows = evidence.getByRole('row');
  await expect(rows).toHaveCount(5);
  await expect(rows.filter({ hasText: 'OpenTSLM · v13' })).toContainText('86.99%');
  await expect(rows.filter({ hasText: 'OpenTSLM · v14' })).toContainText('82.52%');
  await expect(rows.filter({ hasText: 'Logistic regression' })).toContainText('89.84%');
  await expect(rows.filter({ hasText: 'Zero-shot' })).toContainText('23.6%');
  await expect(evidence).toContainText('The baseline is still ahead.');
  await expect(evidence).toContainText('not strictly time-separated');
  await expect(evidence).toContainText('111 answers (45%) were unparseable');
  await expect(evidence).toContainText('not a validated explanation');
  await expect(evidence).toContainText('Docs/PITCH_REQUIREMENTS_CHECKLIST.md');
  await expect(page.locator('main')).not.toContainText('$4.4B');
  await expect(page.getByRole('button', { name: 'Review this signal' })).toHaveCount(0);
  await evidence.screenshot({ path: 'test-results/evidence-desktop.png' });
  await page.locator('#approach').screenshot({ path: 'test-results/approach-desktop.png' });
  await page.locator('#mission-control').screenshot({ path: 'test-results/demo-entry-desktop.png' });
});

test('mobile layout, reduced motion and keyboard entry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#descent')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Resume ambient animation' })).toBeVisible();
  await expect(page.locator('.chapter-hero p')).toHaveText('ESA telemetry. Command history. Time-series language models for human review.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/orbit-mobile.png' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip the cinematic experience' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#evidence')).toBeFocused();
  await page.locator('#evidence').screenshot({ path: 'test-results/evidence-mobile.png' });
  await page.locator('#approach').screenshot({ path: 'test-results/approach-mobile.png' });
  await page.locator('#mission-control').screenshot({ path: 'test-results/demo-entry-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#mission-control').getByRole('link', { name: 'Open demo workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Mission workspace.' })).toBeVisible();
});

test('clean film remains a separate download, not a text-baked player', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('#film-dialog, video')).toHaveCount(0);
  const film = await page.getByRole('link', { name: 'Download text-free video' }).getAttribute('href');
  expect(film).toBe('/films/perigee-descent-clean.mp4');
  const response = await request.head(film!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('video/mp4');
  await expect(page.locator('#scene-description')).toContainText('not an orbital simulation');
});

test('WebGL failure preserves readable copy and entry to the empty demo', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.locator('.flight-stage')).toHaveClass(/static-fallback/);
  await expect(page.getByRole('heading', { name: 'Every signal. In context.' })).toBeVisible();
  await page.getByRole('link', { name: 'Demo preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mission workspace.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run review' })).toBeDisabled();
});
