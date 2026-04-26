import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Profile pages", () => {
  test("private profile /alice/profile loads for logged-in user", async ({ page }) => {
    await loginAs(page, "alice");
    await page.goto("/alice/profile");
    await expect(page).not.toHaveURL(/\/login/);
    // Private profile shows "Profile Settings" heading, not the user's name
    await expect(page.getByRole("heading", { name: "Profile Settings" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("public profile /george loads and shows user info", async ({ page }) => {
    await page.goto("/george");
    await expect(page).toHaveURL(/\/george/);
    await expect(page.getByRole("heading", { name: "George Example" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("follow and unfollow another user", async ({ page }) => {
    await loginAs(page, "alice");
    await page.goto("/george");

    const followBtn = page.getByRole("button", { name: /^Follow$/ });
    const unfollowBtn = page.getByRole("button", { name: /^Unfollow$/ });

    // Ensure we start from a known state: if already following, unfollow first
    if (await unfollowBtn.isVisible()) {
      await unfollowBtn.click();
      await expect(followBtn).toBeVisible({ timeout: 8_000 });
    }

    // Follow
    await followBtn.click();
    await expect(unfollowBtn).toBeVisible({ timeout: 8_000 });

    // Unfollow
    await unfollowBtn.click();
    await expect(followBtn).toBeVisible({ timeout: 8_000 });
  });
});
