import { test, expect, Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// Alice is ADMIN of Portland Makers Guild (seeded), so she has a page profile to switch to.
// Sam messaged the page, so PMG has a conversation with Sam Example.
// Alice also has a personal DM with Sam (seeded).

/**
 * Opens the profile menu, clicks "Switch Profile", then clicks the named profile.
 * Waits for the active profile badge in the trigger to update before returning.
 */
async function switchToPage(page: Page, pageName: string, expectedBadge: string) {
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Switch Profile" }).click();
  await page.getByRole("button", { name: `Switch to ${pageName}` }).click();

  // Wait for activeEntity to update — the trigger badge text confirms the switch completed
  await expect(
    page.locator('button[aria-label="Profile menu"]').getByText(expectedBadge)
  ).toBeVisible({ timeout: 10_000 });
}

async function switchToPersonal(page: Page) {
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Switch Profile" }).click();
  await page.getByRole("button", { name: "Switch to personal profile" }).click();

  // "me" badge confirms the switch back to personal
  await expect(
    page.locator('button[aria-label="Profile menu"]').getByText("me")
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("Profile switching", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "alice");
  });

  test("profile switcher shows managed pages", async ({ page }) => {
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("menuitem", { name: "Switch Profile" }).click();

    await expect(page.getByRole("button", { name: "Switch to Portland Makers Guild" })).toBeVisible();
  });

  test("switch to page profile changes active identity", async ({ page }) => {
    await switchToPage(page, "Portland Makers Guild", "admin");

    // "View Profile" should now link to the page's public profile
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("menuitem", { name: "View Profile" }).click();
    await page.waitForURL(/\/portland-makers-guild/, { timeout: 10_000 });
  });

  test("switch back to personal identity", async ({ page }) => {
    await switchToPage(page, "Portland Makers Guild", "admin");
    await switchToPersonal(page);

    // "View Profile" should now link back to the personal user profile
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("menuitem", { name: "View Profile" }).click();
    await page.waitForURL(/\/alice/, { timeout: 10_000 });
  });

  test("messages inbox is scoped to active profile", async ({ page }) => {
    // Personal inbox: alice has a DM with sam
    await page.goto("/messages");
    await expect(page.getByText("Sam Example")).toBeVisible({ timeout: 10_000 });

    // Switch to Portland Makers Guild and wait for the switch to complete
    await switchToPage(page, "Portland Makers Guild", "admin");

    // Page inbox: sam messaged the page
    await page.goto("/messages");
    await expect(page.getByText("Sam Example")).toBeVisible({ timeout: 10_000 });
  });
});
