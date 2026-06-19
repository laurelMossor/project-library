/**
 * Visibility spec — verifies the three-tier enforcement across key surfaces.
 *
 * Standard test matrix per surface:
 *   (a) anonymous viewer
 *   (b) logged-in non-member
 *   (c) member/follower
 *   (d) owner (implicit — private content is never hidden from its creator)
 *
 * Seed fixtures used:
 *   - secret-workshop (PRIVATE page, creator: sam, member: alice)
 *   - unlisted-zine   (UNLISTED page, creator: alice)
 *   - alice.example   (PUBLIC user)
 *   - sam.example     (PUBLIC user)
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ── PRIVATE page ──────────────────────────────────────────────────────────────

test.describe("PRIVATE page", () => {
	test("anonymous viewer gets 404", async ({ page }) => {
		await page.goto("/secret-workshop");
		// The not-found page renders without the page name
		await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).not.toBeVisible();
	});

	test("member (alice) can view the private page", async ({ page }) => {
		await loginAs(page, "alice");
		await page.goto("/secret-workshop");
		await page.waitForSelector("h1", { timeout: 20_000 });
		await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).toBeVisible();
	});

	test("owner (sam) can view their own private page", async ({ page }) => {
		await loginAs(page, "sam");
		await page.goto("/secret-workshop");
		await page.waitForSelector("h1", { timeout: 20_000 });
		await expect(page.getByRole("heading", { name: "Secret Workshop", exact: true })).toBeVisible();
	});

	test("private page does NOT appear in search results for anonymous", async ({ page }) => {
		await page.goto("/search");
		await page.getByPlaceholder("Search by name or handle...").fill("secret");
		// Wait for debounced search (300ms + render time)
		await page.waitForTimeout(600);
		await expect(page.getByText("Secret Workshop")).not.toBeVisible();
	});

	test("private page does NOT appear in explore feed", async ({ page }) => {
		await page.goto("/explore");
		await expect(page.getByText("Private post")).not.toBeVisible();
	});
});

// ── UNLISTED page ─────────────────────────────────────────────────────────────

test.describe("UNLISTED page", () => {
	test("anonymous viewer can access by direct link", async ({ page }) => {
		await page.goto("/unlisted-zine");
		await page.waitForSelector("h1", { timeout: 20_000 });
		await expect(page.getByRole("heading", { name: "Unlisted Zine", exact: true })).toBeVisible();
	});

	test("logged-in user can access by direct link", async ({ page }) => {
		await loginAs(page, "alice");
		await page.goto("/unlisted-zine");
		await page.waitForSelector("h1", { timeout: 20_000 });
		await expect(page.getByRole("heading", { name: "Unlisted Zine", exact: true })).toBeVisible();
	});

	test("unlisted page does NOT appear in search", async ({ page }) => {
		await page.goto("/search");
		await page.getByPlaceholder("Search by name or handle...").fill("unlisted");
		await page.waitForTimeout(600);
		await expect(page.getByText("Unlisted Zine")).not.toBeVisible();
	});

	test("unlisted page does NOT appear in /explore", async ({ page }) => {
		await page.goto("/explore");
		await expect(page.getByText("Unlisted post")).not.toBeVisible();
	});

	// Over-hide regression: an UNLISTED page must show its UNLISTED posts on its
	// own collection (reachable by link), not render an empty collection.
	test("unlisted page shows its own UNLISTED posts by link", async ({ page }) => {
		await page.goto("/unlisted-zine");
		await page.waitForSelector("h1", { timeout: 20_000 });
		await expect(page.getByText("Unlisted post")).toBeVisible();
	});
});

// ── PRIVATE user ────────────────────────────────────────────────────────────────

test.describe("PRIVATE user", () => {
	test("anonymous viewer gets 404", async ({ page }) => {
		await page.goto("/private-pat.example");
		await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).not.toBeVisible();
	});

	test("logged-in non-follower (sam) gets 404", async ({ page }) => {
		await loginAs(page, "sam");
		await page.goto("/private-pat.example");
		await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).not.toBeVisible();
	});

	test("follower (alice) can view the private profile AND its private posts", async ({ page }) => {
		await loginAs(page, "alice");
		await page.goto("/private-pat.example");
		await page.waitForSelector("h1", { timeout: 20_000 });
		await expect(page.getByRole("heading", { name: "Pat Private", exact: true })).toBeVisible();
		// Over-hide fix: a follower of a PRIVATE user sees that user's PRIVATE content.
		await expect(page.getByText("Private update")).toBeVisible();
	});

	test("private user does NOT appear in search for anonymous", async ({ page }) => {
		await page.goto("/search");
		await page.getByPlaceholder("Search by name or handle...").fill("Pat Private");
		// The PRIVATE user must be filtered out, so the search shows its empty state.
		// Assert the empty state directly — `getByText("Pat Private")` would falsely
		// match the echoed query inside the "No results for “Pat Private”" message.
		await expect(page.getByText(/No results for/i)).toBeVisible();
		await expect(page.getByRole("link", { name: /Pat Private/i })).toHaveCount(0);
	});
});

// ── PUBLIC page ───────────────────────────────────────────────────────────────

test.describe("PUBLIC page (smoke check)", () => {
	test("anonymous viewer can access Portland Makers Guild", async ({ page }) => {
		await page.goto("/portland-makers-guild");
		await page.waitForSelector("h1", { timeout: 20_000 });
		await expect(page.getByRole("heading", { name: "Portland Makers Guild", exact: true })).toBeVisible();
	});

	test("portland-makers-guild appears in search results", async ({ page }) => {
		await page.goto("/search");
		await page.getByPlaceholder("Search by name or handle...").fill("portland");
		await expect(page.getByText("Portland Makers Guild")).toBeVisible({ timeout: 8_000 });
	});
});
