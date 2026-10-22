import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function chapter(
  page: import("@playwright/test").Page,
  title: string,
  id: string,
) {
  const mobile = page.getByLabel("Chapter", { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption(id);
  else
    await page
      .getByRole("navigation", { name: "A2L learning chapters" })
      .getByRole("button", { name: new RegExp(title) })
      .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Learn about A2L", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "A2L Handbook" }),
  ).toBeVisible();
});

test("guide opens at basics, navigates chapters, and preserves open documents", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Start Here", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "File Structure", exact: true }),
  ).toBeVisible();
  await chapter(page, "Glossary", "glossary");
  await expect(page.getByText("A2L / ASAP2", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Learn about A2L", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Powertrain_Demo.a2l" }),
  ).toBeVisible();
});

test("measurement annotations explain selected fields", async ({ page }) => {
  await chapter(page, "Measurements", "measurements");
  await page
    .getByRole("button", { name: "Explain Address", exact: true })
    .click();
  await expect(page.locator(".learn-annotation")).toContainText(
    "not a line number or a file offset",
  );
  await page
    .getByRole("button", { name: "Explain Resolution / accuracy", exact: true })
    .click();
  await expect(page.locator(".learn-annotation")).toContainText(
    "not the scale and offset",
  );
});

test("conversion calculator responds to bounded inputs", async ({ page }) => {
  await chapter(page, "Units & Conversions", "conversions");
  await expect(page.getByLabel("Physical value", { exact: true })).toHaveText(
    "1,000 rpm",
  );
  const slider = page.getByRole("slider", { name: /Raw ECU value/ });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Physical value", { exact: true })).toHaveText(
    "1,025 rpm",
  );
});

test("guide topic search filters chapters and recovers from no results", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search A2L guide" }).filter({ visible: true });
  await search.fill("conversion");
  await chapter(page, "Units & Conversions", "conversions");
  await search.fill("no-such-a2l-topic");
  const mobile = page.getByLabel("Chapter", { exact: true });
  if (await mobile.isVisible()) {
    await expect(mobile.locator("option")).toHaveText(["No matching topics"]);
  } else {
    await expect(page.getByText("No matching topics.", { exact: false })).toBeVisible();
  }
  await search.fill("");
  await chapter(page, "Glossary", "glossary");
});

test("every guide chapter fits the article width", async ({ page }) => {
  for (let index = 0; index < 11; index += 1) {
    const article = page.locator(".learn-main");
    expect(await article.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (index < 10) await page.getByRole("button", { name: "Next", exact: true }).click();
  }
});

test("guide layout fits and has no automated WCAG A/AA violations", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Close A2L guide", exact: true }),
  ).toBeInViewport();
  const overflow = await page
    .getByRole("dialog")
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});
