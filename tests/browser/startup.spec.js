import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('tabletop loads, advances, pauses, changes wiring, and exports a replayable run', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#run-label')).toHaveText('SIMULATION LIVE');
  await expect(page.locator('#spike-count')).not.toHaveText('—');
  await page.locator('#play').click();
  await expect(page.locator('#run-label')).toHaveText('PAUSED');
  const before = await page.locator('#clock').innerText();
  await page.locator('#step').click();
  await expect(page.locator('#clock')).not.toHaveText(before);
  await page.locator('#odor-toggle').click();
  await expect(page.locator('#odor-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#view-toggle').click();
  await page.locator('#stage canvas').click({ position: { x: 450, y: 245 } });
  await page.locator('#light').evaluate(input => { input.value = '60'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#light-value')).toHaveText('60%');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  await download.saveAs('/tmp/fly-table-run.json');
  const run = JSON.parse(readFileSync('/tmp/fly-table-run.json'));
  expect(run.actions.some(a => a.type === 'food')).toBe(true);
  expect(run.actions.some(a => a.type === 'light')).toBe(true);
  expect(run.tick).toBeGreaterThan(0);
  await page.locator('[data-mode=disconnected]').click();
  await expect(page.locator('#edge-count')).toHaveText('0');
  await expect(page.locator('#distance')).toHaveText('0.00');
  await page.locator('#step').click();
  await expect(page.locator('#motor-left')).toHaveText('0.000');
  await page.locator('[data-mode=measured]').click();
  await expect(page.locator('#edge-count')).toHaveText('2,698,236');
  await page.locator('#methods-open').click();
  await expect(page.locator('#methods')).toBeVisible();
  await page.locator('#methods-close').click();
  await page.screenshot({ path: '/tmp/fly-table-fixed.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('opaque gzip transport also loads, while corrupted bytes fail visibly', async ({ page }) => {
  const packed = readFileSync(new URL('../../public/data/connectome.bin.gz', import.meta.url));
  await page.route('**/data/connectome.bin.gz', route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: packed }));
  await page.goto('./');
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#play')).toBeEnabled();
  await page.unroute('**/data/connectome.bin.gz');
  await page.route('**/data/connectome.bin.gz', route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from('corrupted graph') }));
  await page.reload();
  await expect(page.locator('#load-message')).toContainText('integrity check failed');
  await expect(page.locator('#loading')).toBeVisible();
  await expect(page.locator('#play')).toBeDisabled();
});

test('a failed entry module leaves a visible explanation instead of an empty page', async ({ page }) => {
  await page.route(url => url.pathname.endsWith('/src/main.js') || /\/assets\/index-[^/]+\.js$/.test(url.pathname), route => route.abort());
  await page.goto('./');
  await expect(page.locator('#boot-message')).toBeVisible();
  await expect(page.locator('#boot-message')).toContainText('application could not load');
});
