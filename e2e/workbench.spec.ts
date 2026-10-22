import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fixture = (name: string) =>
  `ASAP2_VERSION 1 71\r\n/begin PROJECT Demo "Test"\r\n/begin MODULE ECU "Test module"\r\n/* preserve this */\r\n/begin MEASUREMENT ${name} "Original description" UWORD NO_COMPU_METHOD 1 0 -40 8000\r\nECU_ADDRESS 0x1234\r\n/end MEASUREMENT\r\n/end MODULE\r\n/end PROJECT\r\n`;
async function upload(page: Page, files: { name: string; source: string }[]) {
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      files.map((file) => ({
        name: file.name,
        mimeType: "text/plain",
        buffer: Buffer.from(file.source),
      })),
    );
  await expect(page.getByText("Parsing", { exact: true })).toHaveCount(0);
}
async function openSignal(page: Page, name: string) {
  await page
    .getByRole("button", { name: new RegExp(name + " Original description") })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("Structure checked", { exact: true }),
  ).toBeVisible();
});

test("demo loads usable data and search/type filters work", async ({
  page,
}) => {
  await expect(
    page.getByRole("tab", { name: "Powertrain_Demo.a2l" }),
  ).toBeVisible();
  await page.getByLabel("Search objects", { exact: true }).fill("EngineSpeed");
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
  await page.getByLabel("Filter object type").selectOption("MEASUREMENT");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("EngineSpeed");
  await page
    .getByLabel("Search objects", { exact: true })
    .fill("no-such-signal");
  await expect(
    page.getByRole("heading", { name: "No matching objects" }),
  ).toBeVisible();
});

test("multiple uploads are isolated in switchable tabs", async ({ page }) => {
  await upload(page, [
    { name: "alpha.a2l", source: fixture("Alpha") },
    { name: "beta.a2l", source: fixture("Beta") },
  ]);
  await expect(page.locator("tbody")).toContainText("Alpha");
  await page.getByRole("tab", { name: "beta.a2l", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("Beta");
  await expect(page.locator("tbody")).not.toContainText("Alpha");
  await page.getByRole("tab", { name: "alpha.a2l", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("Alpha");
});

test("property edits preserve bytes around tokens and download correctly", async ({
  page,
}) => {
  const original = fixture("Editable");
  await upload(page, [{ name: "editable.a2l", source: original }]);
  await openSignal(page, "Editable");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Updated description");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.locator("tbody")).toContainText("Updated description");
  if (
    await page
      .getByRole("button", { name: "Close inspector", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Close inspector", exact: true })
      .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save copy", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("editable.a2l");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(
    original.replace("Original description", "Updated description"),
  );
});

test("invalid numeric edits are rejected without changing document", async ({
  page,
}) => {
  await upload(page, [{ name: "numeric.a2l", source: fixture("Numeric") }]);
  await openSignal(page, "Numeric");
  await page.getByLabel("Lower limit", { exact: true }).fill("NaN");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.getByRole("status")).toContainText("Enter a decimal");
  await expect(page.locator("tbody")).toContainText("-40");
});

test("dirty tab close asks before discarding and can be cancelled", async ({
  page,
}) => {
  await upload(page, [{ name: "dirty.a2l", source: fixture("Dirty") }]);
  await openSignal(page, "Dirty");
  await page.getByLabel("Description", { exact: true }).fill("Changed");
  await page.getByRole("button", { name: "Apply changes" }).click();
  await page
    .getByRole("button", { name: "Close inspector", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close dirty.a2l", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(
    page.getByRole("tab", { name: "dirty.a2l", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close dirty.a2l", exact: true })
    .click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(
    page.getByRole("tab", { name: "dirty.a2l", exact: true }),
  ).toHaveCount(0);
});

test("source editor loads and malformed-file diagnostics are inspectable", async ({
  page,
}) => {
  await upload(page, [
    {
      name: "broken.a2l",
      source: '/begin PROJECT Broken "test"\n/* never closed',
    },
  ]);
  await page.getByRole("tab", { name: /^Diagnostics/ }).click();
  await expect(
    page.getByText("Unterminated block comment.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unclosed PROJECT block.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Source", exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("never closed");
});

test("includes produce a visible warning and unknown vendor blocks stay accessible", async ({
  page,
}) => {
  await upload(page, [
    {
      name: "vendor.a2l",
      source:
        '/include "shared.a2l"\n/begin VENDOR_EXTENSION Test 42 /end VENDOR_EXTENSION',
    },
  ]);
  await page.getByLabel("Filter object type").selectOption("BLOCKS");
  await expect(page.locator("tbody")).toContainText("VENDOR EXTENSION");
  await page.getByRole("tab", { name: /^Diagnostics/ }).click();
  await expect(page.getByText(/External include "shared.a2l"/)).toBeVisible();
});

test("untrusted descriptions render as text, not markup", async ({ page }) => {
  const source = fixture("Safe").replace(
    "Original description",
    "<img src=x onerror=alert(1)>",
  );
  await upload(page, [{ name: "safe.a2l", source }]);
  await expect(page.locator("tbody")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("tbody img")).toHaveCount(0);
});

test("binary files are rejected and existing tabs remain intact", async ({
  page,
}) => {
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "binary.a2l",
      mimeType: "application/octet-stream",
      buffer: Buffer.from([0, 1, 2]),
    });
  await expect(page.getByRole("status")).toContainText("NUL");
  await expect(
    page.getByRole("tab", { name: "Powertrain_Demo.a2l" }),
  ).toBeVisible();
});

test("layout fits the viewport and toolbar controls remain reachable", async ({
  page,
}, testInfo) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await expect(
    page.getByRole("button", { name: "Open files", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("tab", { name: "Source", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("workbench.png"),
    fullPage: true,
  });
});

test("workspace meets automated WCAG A/AA checks", async ({ page }) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((item) => ({
      id: item.id,
      description: item.description,
      nodes: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
