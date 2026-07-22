import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";

// Fix for the page-context message notification-email deep link: a link that carries ?asPageId=<page>
// must land a page manager on the page-owned conversation (their session default is personal), switch
// their active identity to that page, clean the URL, and let them reply as the page.
//
// Setup uses the API (no UI dependency): alice is ADMIN of "portland-makers-guild"; sam messages that
// page, creating a [page, sam] conversation alice can only see under the guild identity.
test.use({ storageState: STORAGE_STATE.alice });

const COMPOSER = /Type a message/;

test.describe("Message notification deep link", () => {
  test("?asPageId= opens the page conversation, switches identity, cleans the URL, replies as the page", async ({
    page,
    browser,
  }) => {
    // Resolve the guild id from alice's managed pages.
    const alicePages = await page.request.get("/api/me/pages").then((r) => r.json());
    const guild = alicePages.find(
      (p: { handle?: string; name?: string }) =>
        p.handle === "portland-makers-guild" || /portland makers guild/i.test(p.name ?? ""),
    );
    expect(guild, "seed fixture: portland-makers-guild in alice's pages").toBeTruthy();
    const guildId = guild.id as string;

    // Sam (a non-manager) sends a message TO the guild page, creating the page-owned conversation.
    const samCtx = await browser.newContext({ storageState: STORAGE_STATE.sam });
    let samId: string;
    const content = `Hello from Playwright deeplink ${Date.now()}`;
    try {
      const samMe = await samCtx.request.get("/api/me/user").then((r) => r.json());
      samId = samMe.id as string;
      const send = await samCtx.request.post("/api/messages", {
        data: { recipientPageId: guildId, content },
      });
      expect(send.ok(), "sam → guild message enqueues").toBeTruthy();
    } finally {
      await samCtx.close();
    }

    // Alice starts on her personal identity and follows the email link shape.
    await page.goto(`/messages/u/${samId}?asPageId=${guildId}`);

    // The one-shot switch flips her active identity to the guild (ADMIN badge on the profile menu)...
    await expect(
      page.locator('button[aria-label="Profile menu"]').getByText("admin"),
    ).toBeVisible({ timeout: 10_000 });

    // ...the page-owned conversation loads (sam's message is visible — not an empty personal thread)...
    await expect(page.getByText(content)).toBeVisible({ timeout: 10_000 });

    // ...and the URL is cleaned of the one-shot param.
    await expect
      .poll(() => new URL(page.url()).searchParams.has("asPageId"), { timeout: 10_000 })
      .toBe(false);

    // A reply is composed under the guild identity (asPageId is wired from the active identity), so this
    // sends as the page.
    const reply = `Hello from Playwright reply ${Date.now()}`;
    await page.getByPlaceholder(COMPOSER).fill(reply);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(reply)).toBeVisible({ timeout: 10_000 });
    // Still acting as the guild at send time.
    await expect(
      page.locator('button[aria-label="Profile menu"]').getByText("admin"),
    ).toBeVisible();
  });
});
