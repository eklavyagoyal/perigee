import { test, expect } from '@playwright/test';

test('replays real inputs, exact prompt text and saved output without worker requests', async ({ page }) => {
  const errors: string[] = [];
  const workerRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/api\/|huggingface|openai\.com/.test(request.url())) workerRequests.push(request.url()); });
  await page.goto('/mission-control');
  await expect(page.getByRole('heading', { name: 'Telemetry pipeline.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trace the source' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal reference' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/mission-control-source-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Next pipeline step' }).click();
  await expect(page.getByRole('heading', { name: 'Preserve the shape' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Z-score', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Next pipeline step' }).click();
  await expect(page.getByRole('heading', { name: 'Signal to embeddings' })).toBeVisible();
  await page.getByRole('slider', { name: 'Inspect sample' }).fill('121');
  await expect(page.getByText('Input patch 31', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full window', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Full window', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Inspect sample' })).toHaveAttribute('max', '756');
  const chart = await page.locator('.mc-chart').boundingBox();
  if (!chart) throw new Error('Signal chart has no bounding box');
  await page.mouse.move(chart.x + chart.width * .25, chart.y + chart.height * .5);
  await page.mouse.down();
  await page.mouse.move(chart.x + chart.width * .7, chart.y + chart.height * .5, { steps: 8 });
  await page.mouse.up();
  expect(Number(await page.getByRole('slider', { name: 'Inspect sample' }).getAttribute('min'))).toBeGreaterThan(0);
  expect(Number(await page.getByRole('slider', { name: 'Inspect sample' }).getAttribute('max'))).toBeLessThan(756);
  await page.getByRole('button', { name: 'Full window', exact: true }).click();
  await page.getByRole('button', { name: 'Next pipeline step' }).click();
  await expect(page.getByRole('heading', { name: 'Inside the prompt' })).toBeVisible();
  await expect(page.locator('.mc-prompt-scroll')).toContainText('mean 0.8123 and std 0.0084');
  await expect(page.getByText('Inserted as vectors into inputs_embeds')).toBeVisible();
  await page.screenshot({ path: 'test-results/mission-control-prompt-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Next pipeline step' }).click();
  await expect(page.locator('.mc-recorded-answer pre')).toHaveText('Answer: anomalous');
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await expect(page.locator('.mc-reference-result')).toContainText('Anomaly');
  await expect(page.locator('.mc-reference-result')).toContainText('Matches task label');
  await expect(page.locator('.mc-reference-band')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/mission-control-result-desktop.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
  expect(workerRequests).toEqual([]);
});

test('changing the window clears the reference and preserves a real missed anomaly', async ({ page }) => {
  await page.goto('/mission-control');
  await page.getByRole('button', { name: /Result Recorded response/ }).click();
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await page.getByRole('button', { name: 'Window 02, channel 45, 2009-10-13' }).click();
  await expect(page.locator('.mc-signal')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Trace the source' })).toBeVisible();
  await expect(page.locator('.mc-reference-band')).toHaveCount(0);
  await page.getByRole('button', { name: /Result Recorded response/ }).click();
  await expect(page.locator('.mc-recorded-answer pre')).toHaveText('Answer: nominal');
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await expect(page.getByText('Missed positive', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.mc-recorded-answer pre')).toHaveText('Answer: nominal');
  await page.getByRole('button', { name: 'Reset pipeline' }).click();
  await expect(page.getByRole('heading', { name: 'Trace the source' })).toBeVisible();
  await expect(page.locator('.mc-reference-band')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Full window', exact: true })).toBeDisabled();
});

test('automatic replay can pause, resume and finish on the saved result', async ({ page }) => {
  await page.goto('/mission-control');
  await page.clock.install();
  await page.getByRole('button', { name: 'Replay pipeline', exact: true }).click();
  await page.clock.fastForward(3900);
  await expect(page.getByRole('heading', { name: 'Preserve the shape' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.clock.fastForward(8000);
  await expect(page.getByRole('heading', { name: 'Preserve the shape' })).toBeVisible();
  await page.getByRole('button', { name: 'Replay pipeline', exact: true }).click();
  for (let i = 0; i < 3; i++) await page.clock.fastForward(3900);
  await expect(page.getByRole('heading', { name: 'Model decision' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replay again', exact: true })).toBeVisible();
});

test('evaluation separates rare events from true anomalies across the full cohort', async ({ page }) => {
  await page.goto('/mission-control');
  await page.getByRole('navigation', { name: 'Mission control' }).getByRole('button', { name: 'Evaluation' }).click();
  await expect(page.locator('.mc-metric-row')).toContainText('72.4%');
  await expect(page.locator('.mc-metric-row')).toContainText('100.0%');
  await expect(page.getByText('Saved predictions from the old split', { exact: false })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('68 of 69');
  await page.getByRole('button', { name: 'Anomaly only', exact: true }).click();
  await expect(page.locator('.mc-metric-row')).toContainText('67.6%');
  await expect(page.locator('.mc-metric-row')).toContainText('28.1%');
  await expect(page.locator('.mc-matrix-miss')).toContainText('12');
  await page.screenshot({ path: 'test-results/mission-control-evaluation-desktop.png', fullPage: true, animations: 'disabled' });
});

test('artifacts provide an immutable JSON bundle and signal CSV', async ({ page }) => {
  await page.goto('/mission-control');
  await page.getByRole('navigation', { name: 'Mission control' }).getByRole('button', { name: 'Artifacts' }).click();
  await expect(page.getByText('id_121-channel_45-126-pos', { exact: true })).toBeVisible();
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download signal CSV' }).click();
  expect((await csvDownload).suggestedFilename()).toBe('window-01.csv');
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download replay bundle' }).click();
  expect((await jsonDownload).suggestedFilename()).toBe('perigee-mission-control-replay.json');
});

test('mobile and tablet keep the pipeline controls accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mission-control');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const result = page.getByRole('button', { name: /Result Recorded response/ });
  await result.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Model decision' })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal reference' }).click();
  await page.screenshot({ path: 'test-results/mission-control-mobile.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 820, height: 1180 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mission-control-tablet.png', fullPage: true, animations: 'disabled' });
});

test('source and actual trace render without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/mission-control');
  await expect(page.getByRole('heading', { name: 'Telemetry pipeline.' })).toBeVisible();
  await expect(page.locator('.mc-signal-path')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trace the source' })).toBeVisible();
  await context.close();
});
