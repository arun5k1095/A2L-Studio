import { test, expect } from "@playwright/test";

test("short windows keep long-name properties editable and actions reachable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 590 });
  await page.goto("/");
  const name = "GYS_NIO_SWA_U.GYSvb_IN_ABSSt_GYSvb_IN_ABSSt.qual";
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "long-signals.a2l",
      mimeType: "text/plain",
      buffer: Buffer.from(
        `ASAP2_VERSION 1 71\n/begin PROJECT Test ""\n/begin MODULE ECU ""\n/begin MEASUREMENT ${name} "Generated root interface signal" FLOAT32_IEEE NO_COMPU_METHOD 1 0 -3.402823e38 3.402823e38\n/end MEASUREMENT\n/end MODULE\n/end PROJECT`,
      ),
    });
  await page.getByRole("button", { name: new RegExp(name) }).click();
  const inspector = page.getByRole("complementary", {
    name: "Object inspector",
  });
  await expect(inspector.getByLabel("Name", { exact: true })).toBeInViewport();
  await inspector
    .getByLabel("Upper limit", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    inspector.getByLabel("Upper limit", { exact: true }),
  ).toBeInViewport();
  await inspector.getByLabel("Upper limit", { exact: true }).fill("100");
  await inspector.getByRole("button", { name: "Apply changes" }).click();
  await expect(page.locator("tbody")).toContainText("100");
  await expect(
    page.getByRole("button", { name: "Open files", exact: true }),
  ).toBeInViewport();
  const tableHeight = await page
    .locator(".table-scroll")
    .evaluate((element) => element.clientHeight);
  expect(tableHeight).toBeGreaterThan(250);
  await page.screenshot({ path: testInfo.outputPath("compact-workbench.png") });
});
