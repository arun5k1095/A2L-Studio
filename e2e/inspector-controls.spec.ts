import { test, expect } from '@playwright/test';

test('inspector visibility is labelled, reversible, and retains selection', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Structure checked', { exact: true })).toBeVisible();
  const close = page.getByRole('button', { name: 'Close inspector', exact: true });
  if (await close.isVisible()) await close.click();
  const open = page.getByRole('button', { name: 'Show inspector', exact: true });
  await expect(open).toHaveAttribute('aria-expanded', 'false');
  await open.click();
  await expect(page.getByRole('button', { name: 'Hide inspector', exact: true })).toHaveAttribute('aria-expanded', 'true');
  const selectedName = await page.getByLabel('Name', { exact: true }).inputValue();
  await close.click();
  await expect(open).toBeFocused();
  await open.click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(selectedName);
  const widen = page.getByRole('button', { name: 'Widen inspector', exact: true });
  if (await widen.isVisible()) {
    const inspector = page.getByRole('complementary', { name: 'Object inspector' });
    const originalWidth = await inspector.evaluate(element => element.getBoundingClientRect().width);
    await widen.click();
    await expect.poll(() => inspector.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(originalWidth);
    await page.getByRole('button', { name: 'Narrow inspector', exact: true }).click();
    await expect.poll(() => inspector.evaluate(element => element.getBoundingClientRect().width)).toBe(originalWidth);
  }
  await page.getByLabel('Name', { exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await expect(page.getByRole('complementary', { name: 'Object inspector' })).toHaveCount(0);
});