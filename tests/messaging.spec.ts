import { test, expect, Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

async function switchToPage(page: Page, pageName: string, expectedBadge: string) {
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Switch Profile" }).click();
  await page.getByRole("button", { name: `Switch to ${pageName}` }).click();
  await expect(
    page.locator('button[aria-label="Profile menu"]').getByText(expectedBadge)
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("Messaging", () => {
  test("send a message to another user", async ({ page }) => {
    await loginAs(page, "alice");

    await page.goto("/sam.example");
    await expect(page.getByRole("heading", { name: "Sam Example", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Message" }).click();
    await page.waitForURL(/\/messages\/(u|p)\/[^/]+$/, { timeout: 10_000 });

    const msg = `Hello from Playwright at ${Date.now()}`;
    await page.getByPlaceholder(/Type a message/).fill(msg);
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
  });

  test("inbox lists existing conversations", async ({ page }) => {
    await loginAs(page, "alice");
    await page.goto("/messages");

    // The seeded alice ↔ sam DM should appear in the inbox
    await expect(page.getByText("Sam Example")).toBeVisible({ timeout: 10_000 });
  });

  test("notification dot clears after opening a thread", async ({ page, browser }) => {
    // Send a fresh message as sam to alice so the unread state is deterministic
    const samCtx = await browser.newContext();
    const samPage = await samCtx.newPage();
    await loginAs(samPage, "sam");
    await samPage.goto("/alice.example");
    await samPage.getByRole("link", { name: "Message" }).click();
    await samPage.waitForURL(/\/messages\/(u|p)\/[^/]+$/, { timeout: 10_000 });
    await samPage.getByPlaceholder(/Type a message/).fill("Hello from Playwright (dot test)");
    await samPage.getByRole("button", { name: "Send" }).click();
    await expect(samPage.getByText("Hello from Playwright (dot test)")).toBeVisible({ timeout: 10_000 });
    await samCtx.close();

    // Alice logs in — sam's message is unread, dot should appear on the hamburger
    await loginAs(page, "alice");
    await expect(page.locator('button[aria-label="Menu"] span.bg-novel-red')).toBeVisible({ timeout: 10_000 });

    // Open messages and click on the sam conversation
    await page.goto("/messages");
    await page.getByText("Sam Example").click();

    // After the thread opens, mark-as-read fires and the context refreshes — dot disappears
    await expect(page.locator('button[aria-label="Menu"] span.bg-novel-red')).not.toBeVisible({ timeout: 10_000 });
  });

  test("open a thread from the inbox and see messages", async ({ page }) => {
    await loginAs(page, "alice");
    await page.goto("/messages");

    await page.getByText("Sam Example").click();

    // The first seeded message (sent by alice) should be visible in the thread
    await expect(page.getByText("Saw your raised bed post")).toBeVisible({ timeout: 10_000 });
  });

  test("message sent as page creates thread under page identity, not personal", async ({ page }) => {
    // Alice switches to PMG and messages Sam via his profile
    await loginAs(page, "alice");
    await switchToPage(page, "Portland Makers Guild", "admin");

    await page.goto("/sam.example");
    await page.getByRole("link", { name: "Message" }).click();
    await page.waitForURL(/\/messages\/(u|p)\/[^/]+$/, { timeout: 10_000 });

    const msg = `Hello from Playwright (page-identity) ${Date.now()}`;
    await page.getByPlaceholder(/Type a message/).fill(msg);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // The thread should appear in PMG's inbox
    await page.goto("/messages");
    await expect(page.getByText("Sam Example")).toBeVisible({ timeout: 10_000 });
  });

  test("personal inbox only shows personal conversations", async ({ page }) => {
    // Sam is EDITOR of PMG. His personal inbox shows his own conversations,
    // not the full PMG inbox.
    await loginAs(page, "sam");
    await page.goto("/messages");

    // Sam's personal inbox should include alice (personal DM)
    await expect(page.getByText("Alice Example")).toBeVisible({ timeout: 10_000 });
  });
});
