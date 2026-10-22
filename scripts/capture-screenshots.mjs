import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const output = new URL('../docs/images/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await desktop.newPage();
  await page.goto('http://127.0.0.1:5173/');
  await expect(page.getByText('Structure checked', { exact: true })).toBeVisible();
  await page.getByLabel('Filter object type').selectOption('MEASUREMENT');
  await page.locator('tbody strong').filter({ hasText: /^EngineSpeed$/ }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('EngineSpeed');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('object-explorer.png', output)), animations: 'disabled' });
  await page.getByRole('button', { name: 'Open source', exact: true }).click();
  await expect(page.locator('.cm-line').filter({ hasText: '/begin MEASUREMENT EngineSpeed ' })).toBeInViewport();
  await page.screenshot({ path: fileURLToPath(new URL('source-editor.png', output)), animations: 'disabled' });
  await page.getByRole('button', { name: 'Learn about A2L', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'A2L Handbook' })).toBeVisible();
  await page.getByRole('navigation', { name: 'A2L learning chapters' }).getByRole('button', { name: /Measurements/ }).click();
  await page.screenshot({ path: fileURLToPath(new URL('a2l-handbook.png', output)), animations: 'disabled' });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto('http://127.0.0.1:5173/');
  await expect(mobilePage.getByText('Structure checked', { exact: true })).toBeVisible();
  await mobilePage.evaluate(() => document.fonts.ready);
  await mobilePage.screenshot({ path: fileURLToPath(new URL('mobile-workbench.png', output)), animations: 'disabled' });
  await mobile.close();
  console.log('Saved four synthetic-demo screenshots to docs/images/.');
} finally {
  await browser.close();
}