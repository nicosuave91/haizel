import { test, expect } from "@playwright/test";

test("chat composer sends a message", async ({ page }) => {
  await page.goto("/chats");
  const input = page.getByPlaceholder("Type a message, use @mentions, or insert a template");
  await input.fill("Testing send from E2E");
  await input.press("Enter");
  await expect(page.getByText("Testing send from E2E")).toBeVisible();
});
