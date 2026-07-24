/**
 * Visibility spec — verifies the two-field model across key surfaces.
 *
 * Model: profileVisibility {PUBLIC, PRIVATE} governs the profile page (PRIVATE = an
 * identity-only stub + request affordance, discoverable in search). contentVisibility
 * {LISTED, UNLISTED, PRIVATE} governs where a profile's posts surface.
 *
 * Seed fixtures:
 *   - secret-workshop      (profileVisibility PRIVATE, contentVisibility PRIVATE; creator sam, follower alice)
 *   - unlisted-zine        (profileVisibility PUBLIC,  contentVisibility UNLISTED; creator alice)
 *   - private-pat.example  (profileVisibility PRIVATE, contentVisibility PRIVATE; follower alice)
 *   - portland-makers-guild (PUBLIC + LISTED)
 *
 * Determinism: gated content surfaces are asserted positively (the stub notice, or the
 * private content's absence), and search waits for the debounced result/empty state.
 */

import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";

const SEARCH_BOX = "Search by name or handle...";

async function search(page: Page, query: string) {
  await page.goto("/search");
  await page.getByPlaceholder(SEARCH_BOX).fill(query);
}

// ── PRIVATE profile (page) — discoverable stub, gated content ─────────────────
test.describe("PRIVATE page", () => {
  test("anonymous viewer sees the identity-only locked stub (not a 404, no leaked details)", async ({ page }) => {
    await page.goto("/secret-workshop");
    // Discoverable: identity + request affordance are shown to everyone, incl. anon.
    await expect(page.getByText("This profile is private")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).toBeVisible();
    // Identity-only: headline/bio and private content must NOT leak in the stub.
    await expect(page.getByText("A private space for close collaborators")).not.toBeVisible();
    await expect(page.getByText("Private post")).not.toBeVisible();
  });

  test("appears in anonymous search results (discoverable as a stub)", async ({ page }) => {
    await search(page, "secret");
    await expect(page.getByRole("link", { name: /Secret Workshop/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test("its PRIVATE content does NOT appear in the explore feed", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible();
    await expect(page.getByText("Private post")).not.toBeVisible();
  });

  test.describe("follower (alice)", () => {
    test.use({ storageState: STORAGE_STATE.alice });
    test("can view the private page fully", async ({ page }) => {
      await page.goto("/secret-workshop");
      await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("This profile is private")).not.toBeVisible();
    });
  });

  test.describe("owner (sam)", () => {
    test.use({ storageState: STORAGE_STATE.sam });
    test("can view their own private page", async ({ page }) => {
      await page.goto("/secret-workshop");
      await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).toBeVisible({ timeout: 20_000 });
    });
  });
});

// ── PUBLIC profile with UNLISTED content ──────────────────────────────────────
test.describe("PUBLIC profile, UNLISTED content", () => {
  test("anonymous viewer sees the full profile and its UNLISTED posts by link", async ({ page }) => {
    await page.goto("/unlisted-zine");
    await expect(page.getByRole("heading", { name: "Unlisted Zine", exact: true })).toBeVisible({ timeout: 20_000 });
    // UNLISTED content is visible ON the profile (just not in feeds).
    await expect(page.getByText("Unlisted post")).toBeVisible();
  });

  test("appears in search (the profile is PUBLIC/discoverable)", async ({ page }) => {
    await search(page, "unlisted");
    await expect(page.getByRole("link", { name: /Unlisted Zine/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test("its UNLISTED content does NOT appear in the explore feed", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible();
    await expect(page.getByText("Unlisted post")).not.toBeVisible();
  });
});

// ── PRIVATE profile (user) ────────────────────────────────────────────────────
test.describe("PRIVATE user", () => {
  test("anonymous viewer sees the identity-only stub (discoverable, not a 404)", async ({ page }) => {
    await page.goto("/private-pat.example");
    await expect(page.getByText("This profile is private")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).toBeVisible();
    // No headline/private content leaks in the stub.
    await expect(page.getByText("A private maker")).not.toBeVisible();
    await expect(page.getByText("Private update")).not.toBeVisible();
  });

  test("appears in anonymous search results (as a stub)", async ({ page }) => {
    await search(page, "Pat Private");
    await expect(page.getByRole("link", { name: /Pat Private/i }).first()).toBeVisible({ timeout: 8_000 });
  });

  test.describe("logged-in non-follower (sam)", () => {
    test.use({ storageState: STORAGE_STATE.sam });
    test("sees the locked preview stub, not the private content", async ({ page }) => {
      await page.goto("/private-pat.example");
      await expect(page.getByText("This profile is private")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("Private update")).not.toBeVisible();
    });
  });

  test.describe("follower (alice)", () => {
    test.use({ storageState: STORAGE_STATE.alice });
    test("can view the private profile AND its private posts", async ({ page }) => {
      await page.goto("/private-pat.example");
      await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("Private update")).toBeVisible();
    });
  });
});

// ── PUBLIC page (smoke check) ───────────────────────────────────────────────
test.describe("PUBLIC page", () => {
  test("anonymous viewer can access it", async ({ page }) => {
    await page.goto("/portland-makers-guild");
    await expect(page.getByRole("heading", { name: "Portland Makers Guild", exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("appears in search results", async ({ page }) => {
    await search(page, "portland");
    await expect(page.getByText("Portland Makers Guild")).toBeVisible({ timeout: 8_000 });
  });
});
