import { test, expect } from '@playwright/test';

test('Next navigation opens an empty workspace without pipeline traffic', async ({ page }) => {
  const errors: string[] = [];
  const pipelineRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/pipeline')) pipelineRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('#descent')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('link', { name: 'Demo preview', exact: true }).click();
  await expect(page).toHaveURL(/\/mission-control$/);
  await expect(page.getByRole('heading', { name: 'Mission workspace.' })).toBeVisible();
  await expect(page.getByText('DESIGN PREVIEW', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run review' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Select sample' })).toBeDisabled();
  await expect(page.getByText('No model response.', { exact: true })).toBeVisible();
  await expect(page.locator('canvas, video, input[type="password"]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/workspace-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'Back to the experience' }).click();
  await expect(page.locator('#descent')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'First deviation', exact: true }).click();
  await expect(page.locator('#descent')).toHaveAttribute('data-phase', '1');
  expect(pipelineRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('server-rendered pitch and empty overview are readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/');
  await expect(page.getByRole('heading', { name: 'Every signal. In context.' })).toBeVisible();
  await expect(page.locator('#evidence')).toContainText('86.99%');
  await expect(page.locator('#evidence')).toContainText('89.84%');
  await page.getByRole('link', { name: 'Demo preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mission workspace.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run review' })).toBeDisabled();
  await expect(page.getByText('No model response.', { exact: true })).toBeVisible();
  await context.close();
});

test('workspace sections are local empty placeholders, including keyboard navigation', async ({ page }) => {
  const pipelineRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/pipeline')) pipelineRequests.push(request.url()); });
  await page.goto('/mission-control');
  const nav = page.getByRole('navigation', { name: 'Workspace sections' });
  await nav.getByRole('button', { name: 'Dataset' }).click();
  await expect(page.getByRole('heading', { name: 'No dataset selected.' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Dataset' })).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'No evaluation loaded.' })).toBeVisible();
  await nav.getByRole('button', { name: 'Artifacts' }).click();
  await expect(page.getByRole('heading', { name: 'No artifacts attached.' })).toBeVisible();
  await nav.getByRole('button', { name: 'Overview' }).click();
  await expect(page.getByRole('heading', { name: 'Your first signal goes here.' })).toBeVisible();
  expect(pipelineRequests).toEqual([]);
});
