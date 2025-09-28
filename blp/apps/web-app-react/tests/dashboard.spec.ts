import { test, expect } from "@playwright/test";

test("dashboard filter pill updates selection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good afternoon, Jamie" })).toBeVisible();
  const pill = page.getByRole("button", { name: "Overdue" });
  await pill.click();
  await expect(pill).toHaveClass(/bg-hz-primary/);
});
