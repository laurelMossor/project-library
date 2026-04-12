import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Authoring — create content", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "alice");
  });

  // ─── Events ───────────────────────────────────────────────────────────────

  test("create, publish, and delete an event (batched save)", async ({ page }) => {
    // /events/new creates a draft and immediately redirects to the event detail page
    await page.goto("/events/new");
    await page.waitForURL(/\/events\/[^/]+$/, { timeout: 15_000 });

    // Draft banner should be visible
    await expect(page.getByText("Draft — only you can see this")).toBeVisible();

    // Inline-edit title — click the field, type, then close (session bar handles save)
    await page.getByRole("button", { name: /Event name/i }).first().click();
    await page.getByPlaceholder("Event name").fill("Playwright Test Event");
    // Escape closes the field edit UI, value stays in dirty state
    await page.keyboard.press("Escape");
    await expect(page.getByText("1 unsaved change")).toBeVisible();

    // Inline-edit description
    await page.getByRole("button", { name: /What should people know/i }).first().click();
    await page.getByPlaceholder("What should people know?").fill("This event was created by an automated test.");
    await page.keyboard.press("Escape");
    await expect(page.getByText(/unsaved change/)).toBeVisible();

    // Save via session bar
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Playwright Test Event")).toBeVisible();
    await expect(page.getByText(/unsaved change/)).not.toBeVisible();

    // Publish — only enabled after save (no dirty fields)
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
    await page.goto("/events/new");
    await page.waitForURL(/\/events\/[^/]+$/, { timeout: 15_000 });

    const eventId = page.url().split("/events/")[1];

    const cleanupFired = page.waitForEvent("console", {
      predicate: (msg) => msg.text().includes("deleting draft event on navigation away"),
      timeout: 10_000,
    });

    // SPA navigation via the Explore link unmounts EventPageClient, triggering cleanup
    await page.getByRole("link", { name: "Explore" }).click();
    await page.waitForURL(/\/explore/, { timeout: 10_000 });

    await cleanupFired;

    await page.waitForFunction(
      async (id) => {
        const resp = await fetch(`/api/events/${id}`);
        return resp.status === 404;
      },
      eventId,
      { timeout: 10_000, polling: 500 }
    );
  });

  // ─── Posts ────────────────────────────────────────────────────────────────

  test("create, publish, and delete a post (draft-then-inline-edit)", async ({ page }) => {
    // /posts/new creates a DRAFT and immediately redirects to the post detail page
    await page.goto("/posts/new");
    await page.waitForURL(/\/posts\/[^/]+$/, { timeout: 15_000 });

    // Draft banner should be visible
    await expect(page.getByText("Draft — only you can see this")).toBeVisible();

    // Inline-edit title
    await page.getByRole("button", { name: /Title \(optional\)/i }).first().click();
    await page.getByPlaceholder("Title (optional)").fill("Playwright Test Post");
    await page.keyboard.press("Escape");

    // Inline-edit content
    await page.getByRole("button", { name: /What are you working on/i }).first().click();
    await page.getByPlaceholder("What are you working on or thinking about?").fill("This post was created by an automated test.");
    await page.keyboard.press("Escape");

    await expect(page.getByText(/unsaved change/)).toBeVisible();

    // Save via session bar
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Playwright Test Post")).toBeVisible();

    // Publish — only enabled after save
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Live")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Draft — only you can see this")).not.toBeVisible();

    // Delete — two-step confirm
    await page.getByRole("button", { name: "Delete Post" }).click();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Redirects to /explore after deletion
    await page.waitForURL(/\/explore/, { timeout: 10_000 });
  });

  test("draft post is not visible to public", async ({ page, browser }) => {
    // Create a draft post as alice
    await page.goto("/posts/new");
    await page.waitForURL(/\/posts\/[^/]+$/, { timeout: 15_000 });
    const postUrl = page.url();

    // A fresh (unauthenticated) browser context should see 404 for the draft
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(postUrl);
    // Draft post redirects to notFound — Next.js renders a 404 page
    await expect(anonPage.getByText(/404|not found/i)).toBeVisible({ timeout: 10_000 });
    await anonContext.close();

    // Clean up: delete the draft
    const postId = postUrl.split("/posts/")[1];
    await page.request.delete(`/api/posts/${postId}`);
  });

  // ─── Pages ────────────────────────────────────────────────────────────────

  test("create a page (redirects to public profile for inline editing)", async ({ page }) => {
    const slug = `playwright-test-${Date.now()}`;
    await page.goto("/pages/new");
    await expect(page).toHaveURL(/\/pages\/new/);

    await page.locator("#name").fill("Playwright Test Page");
    await page.locator("#slug").fill(slug);
    await page.getByRole("button", { name: "Create Page" }).click();

    // After creation, redirects to the public page profile for inline editing
    await page.waitForURL(new RegExp(`/p/${slug}`), { timeout: 10_000 });
    await expect(page.locator("body")).toContainText("Playwright Test Page");
    await expect(page.locator("body")).not.toContainText("error");
  });

  // ─── Profile inline editing ───────────────────────────────────────────────

  test("user can inline-edit their profile on public page", async ({ page }) => {
    // Navigate to own public profile
    await page.goto("/u/alice");

    // Should see the inline-edit affordance (own profile)
    // Click on the headline field to open edit
    const headlineField = page.getByRole("button", { name: /Add a headline/i }).first();
    if (await headlineField.isVisible()) {
      await headlineField.click();
      await page.getByPlaceholder("Add a headline").fill("Test headline from Playwright");
      await page.keyboard.press("Escape");
      await expect(page.getByText(/unsaved change/)).toBeVisible();

      // Cancel the edit
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByText(/unsaved change/)).not.toBeVisible();
    }
  });
});
