import { test, expect } from '@playwright/test';

for (const newline of ['\n', '\r\n']) {
  test(`Open source reveals the selected block far down a ${newline === '\n' ? 'LF' : 'CRLF'} document`, async ({ page }) => {
    await page.goto('/');
    const before = Array.from({ length: 200 }, (_, index) => `/begin MEASUREMENT Signal_${index} "Signal" UWORD NO_COMPU_METHOD 1 0 0 100\n/end MEASUREMENT`).join('\n');
    const source = `ASAP2_VERSION 1 71\n/begin PROJECT Test ""\n/begin MODULE ECU ""\n${before}\n/begin MEASUREMENT ExactTarget "Target description" UWORD NO_COMPU_METHOD 1 0 0 100\n/end MEASUREMENT\n/end MODULE\n/end PROJECT`.replaceAll('\n', newline);
    await page.locator('input[type="file"]').setInputFiles({ name: 'navigation.a2l', mimeType: 'text/plain', buffer: Buffer.from(source) });
    await page.getByLabel('Search objects', { exact: true }).fill('ExactTarget');
    await page.locator('tbody .object-name').filter({ hasText: 'ExactTarget' }).click();
    await page.getByRole('button', { name: 'Open source', exact: true }).click();
    const targetLine = page.locator('.cm-line').filter({ hasText: '/begin MEASUREMENT ExactTarget' });
    await expect(targetLine).toBeInViewport();
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect.poll(() => page.locator('.cm-scroller').evaluate(element => element.scrollTop)).toBeGreaterThan(1000);
    await expect(page.locator('.cm-selectionBackground').first()).toBeVisible();
  });
}