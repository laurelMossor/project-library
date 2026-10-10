import { expect, type Page } from "@playwright/test";

/**
 * Switch to the named page. If that identity is already active, return immediately:
 * the menu only offers other identities, so a second switch in the same session
 * has no "Switch to" button. Otherwise open the menu and wait for the badge.
 *
 * @param expectedBadge the lowercased role shown on the trigger after the switch
 *   (e.g. "admin", "editor") — see NavProfileTag's `activeBadge`.
 */
export async function switchToPage(page: Page, pageName: string, expectedBadge: string) {
  const trigger = page.locator('button[aria-label="Profile menu"]');
  await expect(trigger).toBeVisible();
  // The switcher only lists other identities. A second switch in the same session is already there.
  if ((await trigger.getByText(pageName).count()) > 0 && (await trigger.getByText(expectedBadge).count()) > 0) {
    return;
  }
  await trigger.click();
  await page.getByRole("menuitem", { name: "Switch Profile" }).click();
  await page.getByRole("button", { name: `Switch to ${pageName}` }).click();
  await expect(trigger.getByText(expectedBadge)).toBeVisible({ timeout: 10_000 });
}

/** Switch the active identity back to the personal user profile ("me" badge). */
export async function switchToPersonal(page: Page) {
  const trigger = page.locator('button[aria-label="Profile menu"]');
  await expect(trigger).toBeVisible();
  if ((await trigger.getByText("me").count()) > 0) return;
  await trigger.click();
  await page.getByRole("menuitem", { name: "Switch Profile" }).click();
  await page.getByRole("button", { name: "Switch to personal profile" }).click();
  await expect(trigger.getByText("me")).toBeVisible({ timeout: 10_000 });
}
