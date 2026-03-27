import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Authoring — create content", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "alice");
  });

  test("create and publish an event", async ({ page }) => {
    // /events/new creates a draft and immediately redirects to the event detail page
    await page.goto("/events/new");
    await page.waitForURL(/\/events\/[^/]+$/, { timeout: 15_000 });

    // Draft banner should be visible
    await expect(page.getByText("Draft — only you can see this")).toBeVisible();

    // Click the title inline editable to activate it
    await page.getByRole("button", { name: /Event name/i }).first().click();
    await page.getByPlaceholder("Event name").fill("Playwright Test Event");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Playwright Test Event")).toBeVisible();

    // Click the content inline editable
    await page.getByRole("button", { name: /What should people know/i }).first().click();
    await page.getByPlaceholder("What should people know?").fill("This event was created by an automated test.");
    await page.getByRole("button", { name: "Save" }).click();

    // Publish
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Live")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Draft — only you can see this")).not.toBeVisible();
  });

  test("create a post", async ({ page }) => {
    await page.goto("/posts/new");
    await expect(page).toHaveURL(/\/posts\/new/);

    await page.getByPlaceholder("Give your post a title").fill("Playwright Test Post");
    await page.getByPlaceholder("What are you working on or thinking about?").fill("This post was created by an automated test.");
    await page.getByRole("button", { name: "Post" }).click();

    // Redirects to post detail
    await page.waitForURL(/\/posts\/[^/]+$/, { timeout: 10_000 });
    await expect(page.getByText("Playwright Test Post")).toBeVisible();
  });

  test("create a page", async ({ page }) => {
    const slug = `playwright-test-${Date.now()}`;
    await page.goto("/pages/new");
    await expect(page).toHaveURL(/\/pages\/new/);

    await page.locator("#name").fill("Playwright Test Page");
    await page.locator("#slug").fill(slug);
    await page.getByRole("button", { name: "Create Page" }).click();

    // Redirects to private user profile after page creation
    await page.waitForURL(/\/u\/profile/, { timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText("error");

    // Verify the page is accessible
    await page.goto(`/p/${slug}`);
    await expect(page.locator("body")).toContainText("Playwright Test Page");
  });
});
