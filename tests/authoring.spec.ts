import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Authoring — create content", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "alice");
  });

  test("create, publish, and delete an event", async ({ page }) => {
    // /events/new renders the creation surface directly — no redirect until Publish
    await page.goto("/events/new");

    // Draft banner should be visible on the creation page
    await expect(page.getByText("Draft — only you can see this")).toBeVisible();

    // Inline-edit title (local state only — no DB write yet)
    await page.getByRole("button", { name: /Event name/i }).first().click();
    await page.getByPlaceholder("Event name").fill("Playwright Test Event");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Playwright Test Event")).toBeVisible();

    // Inline-edit description (local state only — no DB write yet)
    await page.getByRole("button", { name: /What should people know/i }).first().click();
    await page.getByPlaceholder("What should people know?").fill("This event was created by an automated test.");
    await page.getByRole("button", { name: "Save" }).click();

    // Publish — single DB write; redirects to /events/[id]
    await page.getByRole("button", { name: "Publish" }).click();
    await page.waitForURL(/\/events\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByText("Live")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Draft — only you can see this")).not.toBeVisible();

    // Delete — two-step confirm
    await page.getByRole("button", { name: "Delete Event" }).click();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Redirects to /collections after deletion
    await page.waitForURL(/\/collections/, { timeout: 10_000 });
  });

  test("navigating away from the new event page does not create a DB record", async ({ page }) => {
    // Record the published event count before visiting the creation page
    const beforeResponse = await page.request.get("/api/events");
    const eventsBefore: unknown[] = await beforeResponse.json();
    const countBefore = eventsBefore.length;

    // Visit the creation page — no DB write happens just by visiting
    await page.goto("/events/new");

    // URL should stay at /events/new — no redirect (no draft created in DB)
    await expect(page).toHaveURL(/\/events\/new/);
    await expect(page.getByText("Draft — only you can see this")).toBeVisible();

    // Navigate away without publishing
    await page.getByRole("link", { name: "Explore" }).click();
    await page.waitForURL(/\/explore/, { timeout: 10_000 });

    // Give any potential async writes a moment to settle, then verify no event was created
    await page.waitForTimeout(1000);
    const afterResponse = await page.request.get("/api/events");
    const eventsAfter: unknown[] = await afterResponse.json();
    expect(eventsAfter.length).toBe(countBefore);
  });

  test("create and delete a post", async ({ page }) => {
    await page.goto("/posts/new");
    await expect(page).toHaveURL(/\/posts\/new/);

    await page.getByPlaceholder("Give your post a title").fill("Playwright Test Post");
    await page.getByPlaceholder("What are you working on or thinking about?").fill("This post was created by an automated test.");
    await page.getByRole("button", { name: "Post" }).click();

    // Redirects to post detail
    await page.waitForURL(/\/posts\/[^/]+$/, { timeout: 10_000 });
    await expect(page.getByText("Playwright Test Post")).toBeVisible();

    // Delete — two-step confirm
    await page.getByRole("button", { name: "Delete Post" }).click();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Redirects to /explore after deletion
    await page.waitForURL(/\/explore/, { timeout: 10_000 });
  });

  test("create a page", async ({ page }) => {
    // NOTE: No delete UI exists for pages — this test leaves a record in the DB.
    // Clean up manually: DELETE FROM "Page" WHERE slug LIKE 'playwright-test-%';
    const slug = `playwright-test-${Date.now()}`;
    await page.goto("/pages/new");
    await expect(page).toHaveURL(/\/pages\/new/);

    await page.locator("#name").fill("Playwright Test Page");
    await page.locator("#slug").fill(slug);
    await page.getByRole("button", { name: "Create Page" }).click();

    // Redirects to private user profile after page creation
    await page.waitForURL(/\/u\/profile/, { timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText("error");

    // Verify the page is accessible at its slug
    await page.goto(`/p/${slug}`);
    await expect(page.locator("body")).toContainText("Playwright Test Page");
  });
});
