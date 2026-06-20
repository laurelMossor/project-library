/**
 * Visibility spec — verifies the three-tier enforcement across key surfaces.
 *
 * Test matrix per surface: anonymous viewer · logged-in non-member · member /
 * follower · owner (private content is never hidden from its creator).
 *
 * Seed fixtures:
 *   - secret-workshop    (PRIVATE page,  creator: sam,   member: alice)
 *   - unlisted-zine      (UNLISTED page, creator: alice)
 *   - private-pat.example (PRIVATE user, follower: alice)
 *   - portland-makers-guild (PUBLIC page)
 *
 * Patterns used to stay deterministic:
 *   - A gated surface renders the custom not-found page (h1 "Page not found"),
 *     so we assert that *positively* rather than asserting a name is absent
 *     (which would also pass on an unrelated load failure).
 *   - Search is debounced; instead of sleeping we wait for the result/empty
 *     state to settle, then assert the filtered entity has no result link.
 */

import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";

const SEARCH_BOX = "Search by name or handle...";

/** Type a query and wait for the debounced search to settle on a result or empty state. */
async function search(page: Page, query: string) {
  await page.goto("/search");
  await page.getByPlaceholder(SEARCH_BOX).fill(query);
}

// ── PRIVATE page ────────────────────────────────────────────────────────────
test.describe("PRIVATE page", () => {
  test("anonymous viewer gets the not-found page", async ({ page }) => {
    await page.goto("/secret-workshop");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).not.toBeVisible();
  });

  test("does NOT appear in anonymous search results", async ({ page }) => {
    await search(page, "secret");
    await expect(page.getByText(/No results for/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Secret Workshop/i })).toHaveCount(0);
  });

  test("does NOT appear in the explore feed", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible();
    await expect(page.getByText("Private post")).not.toBeVisible();
  });

  test.describe("member (alice)", () => {
    test.use({ storageState: STORAGE_STATE.alice });
    test("can view the private page", async ({ page }) => {
      await page.goto("/secret-workshop");
      await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).toBeVisible({ timeout: 20_000 });
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

// ── UNLISTED page ─────────────────────────────────────────────────────────────
test.describe("UNLISTED page", () => {
  test("anonymous viewer can access by direct link, and sees its UNLISTED posts", async ({ page }) => {
    await page.goto("/unlisted-zine");
    await expect(page.getByRole("heading", { name: "Unlisted Zine", exact: true })).toBeVisible({ timeout: 20_000 });
    // Over-hide regression: the page must show its own UNLISTED posts by link,
    // not render an empty collection.
    await expect(page.getByText("Unlisted post")).toBeVisible();
  });

  test("does NOT appear in search", async ({ page }) => {
    await search(page, "unlisted");
    await expect(page.getByText(/No results for/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Unlisted Zine/i })).toHaveCount(0);
  });

  test("does NOT appear in the explore feed", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible();
    await expect(page.getByText("Unlisted post")).not.toBeVisible();
  });

  test.describe("logged-in user", () => {
    test.use({ storageState: STORAGE_STATE.alice });
    test("can access by direct link", async ({ page }) => {
      await page.goto("/unlisted-zine");
      await expect(page.getByRole("heading", { name: "Unlisted Zine", exact: true })).toBeVisible({ timeout: 20_000 });
    });
  });
});

// ── PRIVATE user ──────────────────────────────────────────────────────────────
test.describe("PRIVATE user", () => {
  test("anonymous viewer gets the not-found page", async ({ page }) => {
    await page.goto("/private-pat.example");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).not.toBeVisible();
  });

  test("does NOT appear in anonymous search results", async ({ page }) => {
    await search(page, "Pat Private");
    await expect(page.getByText(/No results for/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Pat Private/i })).toHaveCount(0);
  });

  test.describe("logged-in non-follower (sam)", () => {
    test.use({ storageState: STORAGE_STATE.sam });
    test("gets the not-found page", async ({ page }) => {
      await page.goto("/private-pat.example");
      await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).not.toBeVisible();
    });
  });

  test.describe("follower (alice)", () => {
    test.use({ storageState: STORAGE_STATE.alice });
    test("can view the private profile AND its private posts", async ({ page }) => {
      await page.goto("/private-pat.example");
      await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).toBeVisible({ timeout: 20_000 });
      // Over-hide fix: a follower of a PRIVATE user sees that user's PRIVATE content.
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
