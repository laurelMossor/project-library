import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";
import { switchToPage, switchToPersonal } from "./helpers/profile";

// Alice is ADMIN of Portland Makers Guild (seeded) and has a personal DM with
// sam; PMG also has its own conversation with sam (a message sent as the page).
// These cover identity switching and the identity-scoping of inbox + outgoing
// messages — the data-leak surface called out in the schema notes.
test.use({ storageState: STORAGE_STATE.alice });

test.describe("Profile switching", () => {
  test("switcher lists managed pages and switches active identity", async ({ page }) => {
    await page.goto("/explore");
    await switchToPage(page, "Portland Makers Guild", "admin");

    // View Profile now resolves to the page's public profile.
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("menuitem", { name: "View Profile" }).click();
    await page.waitForURL(/\/portland-makers-guild/, { timeout: 10_000 });
  });

  test("switches back to the personal identity", async ({ page }) => {
    await page.goto("/explore");
    await switchToPage(page, "Portland Makers Guild", "admin");
    await switchToPersonal(page);

    // View Profile resolves back to the personal user profile.
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("menuitem", { name: "View Profile" }).click();
    await page.waitForURL(/\/alice\.example/, { timeout: 10_000 });
  });

  test("inbox and outgoing messages are scoped to the active identity", async ({ page }) => {
    // Personal identity: alice's own DM with sam is in her inbox.
    await page.goto("/messages");
    await expect(page.getByText("Sam Example")).toBeVisible({ timeout: 10_000 });

    // Switch to the page and message sam *as the page*.
    await switchToPage(page, "Portland Makers Guild", "admin");
    await page.goto("/sam.example");
    await page.getByRole("link", { name: "Message" }).click();
    await page.waitForURL(/\/messages\/(u|p)\/[^/]+$/, { timeout: 10_000 });

    const msg = `Hello from Playwright (page-identity) ${Date.now()}`;
    await page.getByPlaceholder(/Type a message/).fill(msg);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });

    // The page's inbox shows the conversation it just held with sam.
    await page.goto("/messages");
    await expect(page.getByText("Sam Example")).toBeVisible({ timeout: 10_000 });
  });

  test("following while acting as a page follows as the page — on the profile and on Find people", async ({ page }) => {
    // Personally, alice already follows sam (seeded).
    await page.goto("/sam.example");
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible({ timeout: 10_000 });

    // As the guild, which doesn't follow sam, the same button says Follow.
    await switchToPage(page, "Portland Makers Guild", "admin");
    await page.goto("/sam.example");
    const follow = page.getByRole("button", { name: "Follow", exact: true });
    await expect(follow).toBeVisible({ timeout: 10_000 });
    await follow.click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible({ timeout: 10_000 });

    try {
      // Find people agrees: the card's button reflects the guild's follow.
      await page.goto("/search");
      await page.getByPlaceholder("Search by name or handle...").fill("Sam Ex");
      const card = page.locator("div").filter({ has: page.getByRole("link", { name: /Sam Example/ }) }).last();
      await expect(card.getByRole("button", { name: "Following" })).toBeVisible({ timeout: 10_000 });
    } finally {
      // Unfollow as the guild; alice's own follow of sam is untouched.
      await page.goto("/sam.example");
      await page.getByRole("button", { name: "Unfollow" }).click();
      await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible({ timeout: 10_000 });
      await switchToPersonal(page);
      await page.goto("/sam.example");
      await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible({ timeout: 10_000 });
    }
  });
});
