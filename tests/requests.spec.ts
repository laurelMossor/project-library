/**
 * Request-to-Follow / locked-preview spec — privacy-critical rendering.
 *
 * Requires the `access_requests` migration applied + a reseed (the seed adds a
 * pending FOLLOW request sam → private-pat). The mutating approve/deny and
 * role-change paths are covered by unit tests (tests/unit/requests.test.ts,
 * permission.test.ts); this spec asserts the deterministic, non-mutating
 * surfaces so it can't go flaky on shared DB state:
 *
 *   - anonymous viewer of a PRIVATE profile still gets existence-deny (404)
 *   - a logged-in non-member gets the LOCKED stub, NOT the private content
 *   - the follow button reflects the pending request ("Requested")
 *   - a PUBLIC entity keeps instant-follow (no request)
 *   - the target sees a Requests surface on /connections
 *
 * Seed fixtures: private-pat.example (PRIVATE user) · portland-makers-guild
 * (PUBLIC page, followed by sam) · pending FOLLOW sam → private-pat.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE, submitLogin } from "./helpers/auth";

// ── Existence-deny is preserved for anonymous viewers ─────────────────────────
test("anonymous viewer of a PRIVATE profile still gets the not-found page", async ({ page }) => {
  await page.goto("/private-pat.example");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByText("This profile is private")).not.toBeVisible();
});

// ── Logged-in non-member sees the locked stub, not the content ────────────────
test.describe("logged-in non-member (sam) on a PRIVATE profile", () => {
  test.use({ storageState: STORAGE_STATE.sam });

  test("sees the locked preview stub, not the private content", async ({ page }) => {
    await page.goto("/private-pat.example");
    await expect(page.getByText("This profile is private")).toBeVisible({ timeout: 20_000 });
    // The private content must NOT render in the stub.
    await expect(page.getByText("Private update")).not.toBeVisible();
  });

  test("the follow button reflects the pending request", async ({ page }) => {
    await page.goto("/private-pat.example");
    // Seeded sam → private-pat request → the button reads "Requested".
    await expect(page.getByRole("button", { name: "Requested" })).toBeVisible({ timeout: 20_000 });
  });

  test("a PUBLIC page keeps instant-follow (no request state)", async ({ page }) => {
    // sam already follows portland-makers-guild in the seed → instant "Unfollow",
    // never "Requested".
    await page.goto("/portland-makers-guild");
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Requested" })).not.toBeVisible();
  });
});

// ── The target sees a Requests surface ────────────────────────────────────────
test("private user sees a Requests tab on their connections", async ({ page }) => {
  await page.goto("/login");
  await submitLogin(page, "pat@example.com", "pat");
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });

  await page.goto("/connections");
  await expect(page.getByRole("button", { name: /Requests/ })).toBeVisible({ timeout: 20_000 });
});
