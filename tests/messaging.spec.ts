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

  test("inbox lists existing conversations", async ({ page }) => {
    await loginAs(page, "alice");
    await page.goto("/messages");

    // The seeded alice ↔ dolores DM should appear in the inbox
    await expect(page.getByText("Dolores Example")).toBeVisible({ timeout: 10_000 });
  });

  test("notification dot clears after opening a thread", async ({ page, browser }) => {
    // Send a fresh message as dolores to alice so the unread state is deterministic
    // (seeded readAt values may already be set from prior sessions).
    const doloresCtx = await browser.newContext();
    const doloresPage = await doloresCtx.newPage();
    await loginAs(doloresPage, "dolores");
    await doloresPage.goto("/u/alice");
    await doloresPage.getByRole("link", { name: "Send Message" }).click();
    await doloresPage.waitForURL(/\/messages\/[^/]+$/, { timeout: 10_000 });
    await doloresPage.getByPlaceholder(/Type a message/).fill("Hello from Playwright (dot test)");
    await doloresPage.getByRole("button", { name: "Send" }).click();
    await expect(doloresPage.getByText("Hello from Playwright (dot test)")).toBeVisible({ timeout: 10_000 });
    await doloresCtx.close();

    // Alice logs in — dolores's message is unread, dot should appear on the hamburger
    await loginAs(page, "alice");
    await expect(page.locator('button[aria-label="Menu"] span.bg-novel-red')).toBeVisible({ timeout: 10_000 });

    // Open messages and click on the dolores conversation
    await page.goto("/messages");
    await page.getByText("Dolores Example").click();

    // After the thread opens, mark-as-read fires and the context refreshes — dot disappears
    await expect(page.locator('button[aria-label="Menu"] span.bg-novel-red')).not.toBeVisible({ timeout: 10_000 });
  });

  test("open a thread from the inbox and see messages", async ({ page }) => {
    await loginAs(page, "alice");
    await page.goto("/messages");

    // Click on the dolores conversation row to open the thread
    await page.getByText("Dolores Example").click();

    // The first seeded message (sent by alice) should be visible in the thread
    await expect(page.getByText("Hey! Saw your work")).toBeVisible({ timeout: 10_000 });
  });
});
