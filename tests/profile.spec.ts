import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";

// Follow/unfollow is the unique behavior here; plain public-profile render is
// covered by public.spec (alice) and the messaging/switching specs (sam).
test.describe("Profile pages — as alice", () => {
  test.use({ storageState: STORAGE_STATE.alice });

  test("follow and unfollow another user", async ({ page }) => {
    // ProfileButtons fetches follow status only after the auth context loads,
    // so the button briefly shows a stale "Follow" before settling. Wait for
    // that GET so we read the real DB-backed state, not the placeholder.
    const followStatus = page.waitForResponse(
      (r) => /\/api\/follows\/[^/]+/.test(r.url()) && r.request().method() === "GET",
      { timeout: 10_000 },
    );
    await page.goto("/sam.example");
    await followStatus;

    const followBtn = page.getByRole("button", { name: /^Follow$/ });
    const unfollowBtn = page.getByRole("button", { name: /^Unfollow$/ });

    // The button reflects the settled follow status.
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
