import { test, expect } from '@playwright/test';

test('minimal cinematic journey keeps dramatic copy and optional scene controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#descent')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('heading', { name: 'Years of work. One mission.' })).toBeInViewport();
  await expect(page.locator('.landing .brand')).toHaveCount(0);
  await expect(page.locator('.landing-header a')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Pause ambient animation' })).not.toBeVisible();
  await page.screenshot({ path: 'test-results/orbit-desktop.png' });
  await page.getByText('Scene controls', { exact: true }).click();
  await page.getByRole('button', { name: 'Atmospheric re-entry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Then everything changes.' })).toBeVisible();
  await page.getByText('Scene controls', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/reentry-desktop.png' });
  await page.getByText('Scene controls', { exact: true }).click();
  await page.getByRole('button', { name: 'Enable atmospheric sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute atmospheric sound' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mute atmospheric sound' }).click();
  await page.getByRole('button', { name: 'Pause ambient animation' }).click();
  await expect(page.getByRole('button', { name: 'Resume ambient animation' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Protect the mission', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'An anomaly shouldn’t end a mission.' })).toBeVisible();
  await expect(page.locator('[data-chapter="0"]')).toHaveAttribute('inert', '');
  await page.getByText('Scene controls', { exact: true }).click();
  await page.screenshot({ path: 'test-results/final-desktop.png' });
  expect(errors).toEqual([]);
});

test('three checklist figures remain honest with expandable methodology', async ({ page }) => {
  await page.goto('/#evidence');
  const evidence = page.locator('#evidence');
  await expect(evidence.getByRole('heading', { name: 'Find the signal. Understand the context.' })).toBeVisible();
  await expect(evidence.locator('.landing-metrics article')).toHaveCount(3);
  await expect(evidence).toContainText('Same accuracy. Similar F1.');
  await expect(evidence).toContainText('not flight validation');
  await expect(evidence.getByRole('table')).not.toBeVisible();
  await expect(page.locator('#approach, .pitch-window-preview, .brand')).toHaveCount(0);
  await evidence.screenshot({ path: 'test-results/evidence-desktop.png' });
  await page.getByText('Experiment details & limitations', { exact: false }).click();
  await expect(evidence.getByRole('table')).toBeVisible();
  for (const [name, accuracy] of [['OpenTSLM · balanced sampling', '86.99%'], ['Logistic regression · restricted', '86.99%']]) {
    await expect(evidence.getByRole('row').filter({ hasText: name })).toContainText(accuracy);
  }
  await expect(evidence).toContainText('not strictly time-separated');
  await expect(evidence).toContainText('68 of 69 test event IDs also in training');
  await expect(evidence).toContainText('not a validated explanation');
  await expect(evidence).toContainText('Docs/PITCH_REQUIREMENTS_CHECKLIST.md');
  await evidence.screenshot({ path: 'test-results/methodology-desktop.png' });
});

test('mobile reduced-motion journey and keyboard skip link remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#descent')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: 'test-results/orbit-mobile.png' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip the cinematic experience' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#evidence')).toBeFocused();
  await page.locator('#evidence').screenshot({ path: 'test-results/evidence-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await page.getByText('Scene controls', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume ambient animation' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Protect the mission', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'An anomaly shouldn’t end a mission.' })).toBeVisible();
  await page.getByText('Scene controls', { exact: true }).click();
  await page.screenshot({ path: 'test-results/final-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('landing links to Mission Control without initiating inference; clean film is unchanged', async ({ page, request }) => {
  const jobs: string[] = [];
  page.on('request', req => { if (req.url().includes('/api/pipeline/jobs')) jobs.push(req.url()); });
  await page.goto('/');
  await expect(page.locator('.landing-header a')).toHaveAttribute('href', '/mission-control');
  await expect(page.locator('#evidence').getByRole('link', { name: 'Open mission control' })).toHaveAttribute('href', '/mission-control');
  await expect(page.locator('video, #film-dialog')).toHaveCount(0);
  const film = await page.getByRole('link', { name: 'Download text-free video' }).getAttribute('href');
  expect(film).toBe('/films/perigee-descent-clean.mp4');
  expect((await request.head(film!)).status()).toBe(200);
  await expect(page.locator('#scene-description')).toContainText('not an orbital simulation');
  expect(jobs).toEqual([]);
});

test('WebGL fallback preserves the dramatic headline and research', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.locator('.flight-stage')).toHaveClass(/static-fallback/);
  await expect(page.getByRole('heading', { name: 'Years of work. One mission.' })).toBeVisible();
  await expect(page.locator('#evidence')).toContainText('86.99%');
});
