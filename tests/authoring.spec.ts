import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Authoring — create content", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "alice");
  });

  test("create, publish, and delete an event", async ({ page }) => {
    // /events/new creates a draft and immediately redirects to the event detail page
    await page.goto("/events/new");
    await page.waitForURL(/\/events\/[^/]+$/, { timeout: 15_000 });

    // Draft banner should be visible
    await expect(page.getByText("Draft — only you can see this")).toBeVisible();

    // Inline-edit title
    await page.getByRole("button", { name: /Event name/i }).first().click();
    await page.getByPlaceholder("Event name").fill("Playwright Test Event");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Playwright Test Event")).toBeVisible();

    // Inline-edit description
    await page.getByRole("button", { name: /What should people know/i }).first().click();
    await page.getByPlaceholder("What should people know?").fill("This event was created by an automated test.");
    await page.getByRole("button", { name: "Save" }).click();

    // Publish
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Live")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Draft — only you can see this")).not.toBeVisible();

    // Delete — two-step confirm
    await page.getByRole("button", { name: "Delete Event" }).click();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Redirects to /collections after deletion
    await page.waitForURL(/\/collections/, { timeout: 10_000 });
  });

  test("navigating away from a draft event deletes it", async ({ page }) => {
    // Create a draft event
    await page.goto("/events/new");
    await page.waitForURL(/\/events\/[^/]+$/, { timeout: 15_000 });

    const eventId = page.url().split("/events/")[1];

    // Set up console listener BEFORE navigating — the cleanup effect logs when it fires,
    // which confirms the useEffect cleanup actually ran (not just that the test passed by coincidence)
    const cleanupFired = page.waitForEvent("console", {
      predicate: (msg) => msg.text().includes("deleting draft event on navigation away"),
      timeout: 10_000,
    });

    // SPA navigation via the Explore link unmounts EventPageClient, triggering the
    // cleanup effect which calls deleteEvent in the background
    await page.getByRole("link", { name: "Explore" }).click();
    await page.waitForURL(/\/explore/, { timeout: 10_000 });

    // Confirm the cleanup effect actually ran
    await cleanupFired;

    // Poll the API until the background DELETE completes (max 10s, checks every 500ms)
    await page.waitForFunction(
      async (id) => {
        const resp = await fetch(`/api/events/${id}`);
        return resp.status === 404;
      },
      eventId,
      { timeout: 10_000, polling: 500 }
    );
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
