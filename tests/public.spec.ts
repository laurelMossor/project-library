import "./env";
import { test, expect } from "@playwright/test";
import { createSignupInvite } from "../src/lib/utils/server/signup-invite";
import { SIGNUP_WITH_INVITE } from "../src/lib/const/routes";

test.describe("Public pages — unauthenticated renders", () => {
  test("/welcome loads with key UI", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/welcome/);
    // Page should render without error
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("/explore loads and shows content", async ({ page }) => {
    await page.goto("/explore");
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.locator("body")).not.toContainText("Application error");
    // After seed, should show items (not "No items yet" or empty)
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("/about loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("/login form renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log In" })).toBeVisible();
  });

  test("/signup with invite link shows signup form", async ({ page }) => {
    const email = `pub-invite-${Date.now()}@example.com`;
    const { rawToken } = await createSignupInvite(email);
    await page.goto(SIGNUP_WITH_INVITE(rawToken));
    await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Username")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
  });

  test("/signup without invite shows invitation-only message", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText(/invitation only/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up" })).not.toBeVisible();
  });

  test("/events listing loads", async ({ page }) => {
    await page.goto("/events");
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("seeded user public profile /u/alice loads", async ({ page }) => {
    await page.goto("/u/alice");
    await expect(page).toHaveURL(/\/u\/alice/);
    await expect(page.locator("body")).toContainText("Alice");
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
