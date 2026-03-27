import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Messaging", () => {
  test("send a message to another user", async ({ page }) => {
    await loginAs(page, "alice");

    // Navigate to george's profile to get the Send Message link
    await page.goto("/u/george");
    await expect(page.getByRole("heading", { name: "George Example" })).toBeVisible();

    // Click "Send Message" — this links to /messages/[georgeId]
    await page.getByRole("link", { name: "Send Message" }).click();
    await page.waitForURL(/\/messages\/[^/]+$/, { timeout: 10_000 });

    // Fill in and send a message
    const msg = `Hello from Playwright at ${Date.now()}`;
    await page.getByPlaceholder(/Type a message/).fill(msg);
    await page.getByRole("button", { name: "Send" }).click();

    // Message should appear in the thread
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
  });
});
