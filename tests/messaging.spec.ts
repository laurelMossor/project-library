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

  test("message sent as page creates thread under page identity, not personal", async ({ page }) => {
    // Dolores switches to PMG and messages George via his profile
    await loginAs(page, "dolores");
    await switchToPage(page, "Portland Makers Guild", "admin");

    await page.goto("/u/george");
    await page.getByRole("link", { name: "Send Message" }).click();
    await page.waitForURL(/\/messages\/[^/]+$/, { timeout: 10_000 });

    const msg = `Hello from Playwright (page-identity) ${Date.now()}`;
    await page.getByPlaceholder(/Type a message/).fill(msg);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // The thread should appear in PMG's inbox
    await page.goto("/messages");
    await expect(page.getByText("George Example")).toBeVisible({ timeout: 10_000 });
  });

  test("page admin cannot see another page conversation through personal inbox", async ({ page, browser }) => {
    // George is EDITOR of PMG. The seeded PMG ↔ Sam conversation should NOT
    // leak into George's personal thread with PMG.
    await loginAs(page, "george");
    await page.goto("/messages");

    // George has no personal conversations seeded, so inbox should be empty
    // or only contain threads he's actually part of — not PMG ↔ Sam messages.
    // Open a thread with PMG by messaging the page from George's profile view.
    await page.goto("/p/portland-makers-guild");
    const sendLink = page.getByRole("link", { name: "Send Message" });

    // If there's no send message link on a page profile, navigate directly
    if (await sendLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sendLink.click();
    } else {
      // Trigger a fresh conversation via the messages route
      // George messages PMG from the messages interface
      await page.goto("/messages");
    }

    // Now go to messages and check George's personal inbox
    await page.goto("/messages");

    // The seeded PMG ↔ Sam messages should NOT be visible to George personally.
    // "interested in joining your next workshop" is the seeded Sam → PMG message.
    await expect(page.getByText("interested in joining your next workshop")).not.toBeVisible({ timeout: 3_000 });
  });
});
