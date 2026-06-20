import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";

// Follow/unfollow is the unique behavior here; plain public-profile render is
// covered by public.spec (alice) and the messaging/switching specs (sam).
test.describe("Profile pages — as alice", () => {
  test.use({ storageState: STORAGE_STATE.alice });

  test("follow and unfollow another user", async ({ page }) => {
    await page.goto("/sam.example");

    const followBtn = page.getByRole("button", { name: /^Follow$/ });
    const unfollowBtn = page.getByRole("button", { name: /^Unfollow$/ });

    // The button resolves to one state once the client checks follow status.
    await expect(followBtn.or(unfollowBtn)).toBeVisible({ timeout: 8_000 });

    // Normalize to a known starting state (not following).
    if (await unfollowBtn.isVisible()) {
      await unfollowBtn.click();
      await expect(followBtn).toBeVisible({ timeout: 8_000 });
    }

    await followBtn.click();
    await expect(unfollowBtn).toBeVisible({ timeout: 8_000 });

    await unfollowBtn.click();
    await expect(followBtn).toBeVisible({ timeout: 8_000 });
  });
});
