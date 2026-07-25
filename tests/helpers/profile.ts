import { expect, type Page } from "@playwright/test";

/**
 * Open the profile menu, expand "Switch Profile", and switch to the named page.
 * Waits for the active-identity badge in the trigger to update before returning,
 * so callers can act on the new identity without racing the context refresh.
 *
 * @param expectedBadge the lowercased role shown on the trigger after the switch
 *   (e.g. "admin", "editor") — see NavProfileTag's `activeBadge`.
 */
export async function switchToPage(page: Page, pageName: string, expectedBadge: string) {
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Switch Profile" }).click();
  await page.getByRole("button", { name: `Switch to ${pageName}` }).click();
  await expect(
    page.locator('button[aria-label="Profile menu"]').getByText(expectedBadge),
  ).toBeVisible({ timeout: 10_000 });
}

/** Switch the active identity back to the personal user profile ("me" badge). */
export async function switchToPersonal(page: Page) {
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Switch Profile" }).click();
  await page.getByRole("button", { name: "Switch to personal profile" }).click();
  await expect(
    page.locator('button[aria-label="Profile menu"]').getByText("me"),
  ).toBeVisible({ timeout: 10_000 });
}
