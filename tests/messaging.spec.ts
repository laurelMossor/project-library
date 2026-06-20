import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";

// Messaging mechanics, all from alice's perspective (cached session).
test.use({ storageState: STORAGE_STATE.alice });

const COMPOSER = /Type a message/;
const THREAD_URL = /\/messages\/(u|p)\/[^/]+$/;

test.describe("Messaging", () => {
  test("send a message to another user", async ({ page }) => {
    await page.goto("/sam.example");
    await expect(page.getByRole("heading", { name: "Sam Example", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Message" }).click();
    await page.waitForURL(THREAD_URL, { timeout: 10_000 });

    const msg = `Hello from Playwright at ${Date.now()}`;
    await page.getByPlaceholder(COMPOSER).fill(msg);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
  });

  test("inbox lists a conversation and opens its thread", async ({ page }) => {
    await page.goto("/messages");
    // The seeded alice ↔ sam DM appears in the inbox...
    await page.getByText("Sam Example").click();
    // ...and opening it shows the first seeded message.
    await expect(page.getByText("Saw your raised bed post")).toBeVisible({ timeout: 10_000 });
  });

  test("unread notification dot appears then clears after opening the thread", async ({ page, browser }) => {
    // Sam sends alice a fresh message (reusing sam's cached session — no UI
    // login) so the unread state is deterministic for this run.
    const samCtx = await browser.newContext({ storageState: STORAGE_STATE.sam });
    try {
      const samPage = await samCtx.newPage();
      await samPage.goto("/alice.example");
      await samPage.getByRole("link", { name: "Message" }).click();
      await samPage.waitForURL(THREAD_URL, { timeout: 10_000 });
      const dotMsg = `Hello from Playwright (dot test) ${Date.now()}`;
      await samPage.getByPlaceholder(COMPOSER).fill(dotMsg);
      await samPage.getByRole("button", { name: "Send" }).click();
      await expect(samPage.getByText(dotMsg)).toBeVisible({ timeout: 10_000 });
    } finally {
      await samCtx.close();
    }

    // Alice loads the app: the unread message surfaces the dot on the menu.
    // Located by accessible role/name (role="status", "Unread messages"),
    // not a color class.
    await page.goto("/explore");
    const unreadDot = page.getByRole("status", { name: "Unread messages" });
    await expect(unreadDot).toBeVisible({ timeout: 10_000 });

    // Opening the thread marks it read; the context refreshes and the dot clears.
    await page.goto("/messages");
    await page.getByText("Sam Example").click();
    await expect(unreadDot).not.toBeVisible({ timeout: 10_000 });
  });
});
