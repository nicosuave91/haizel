import { test, expect } from "@playwright/test";

test("pipeline drawer opens for selected loan", async ({ page }) => {
  await page.goto("/pipeline");
  const firstRow = page.locator("tbody tr").first();
  await firstRow.click();
  await expect(page.getByText("Next Steps")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
});
