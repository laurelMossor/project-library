import "./env";
import { test, expect } from "@playwright/test";
import { createSignupInvite } from "../src/lib/utils/server/signup-invite";
import { SIGNUP_WITH_INVITE } from "../src/lib/const/routes";

// Unauthenticated renders. Each test asserts a real, stable piece of the page
// (a heading / form control) rather than merely "no error text" — a blank page
// would pass the latter.
test.describe("Public pages — unauthenticated renders", () => {
  test("/welcome shows the landing content", async ({ page }) => {
    await page.goto("/welcome");
    await expect(page.getByText("See what people are making near you")).toBeVisible();
  });

  test("/explore renders the collection page", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible();
  });

  test("/about renders", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
  });

  test("/login form renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log In" })).toBeVisible();
  });

  test("/signup with a valid invite shows the signup form", async ({ page }) => {
    const { rawToken } = await createSignupInvite(`pub-invite-${Date.now()}@example.com`);
    await page.goto(SIGNUP_WITH_INVITE(rawToken));
    await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Handle")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
  });

  test("/signup without an invite shows the invitation-only message", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText(/invitation only/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign Up" })).not.toBeVisible();
  });

  test("a seeded user's public profile renders their name", async ({ page }) => {
    await page.goto("/alice.example");
    await expect(page.getByRole("heading", { name: "Alice Example", level: 1, exact: true })).toBeVisible();
  });
});
