import { test, expect } from "@playwright/test";
import { loginAs, USERS } from "./helpers/auth";

test.describe("Authentication flows", () => {
  test("valid login redirects away from /login", async ({ page }) => {
    await loginAs(page, "alice");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("invalid login shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(USERS.alice.email);
    await page.getByPlaceholder("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signup with new user succeeds or is rate-limited", async ({ page }) => {
    // Note: /api/auth/signup has an in-memory rate limit of 5/hr per IP.
    // In headless Playwright all requests share the same "unknown" IP key,
    // so this test may hit the limit during repeated local runs.
    // Username max 20 chars — use short suffix (Date.now() % 1e7 = 7 digits, "tst" + 7 = 10)
    const unique = `tst${Date.now() % 1e7}`;
    await page.goto("/signup");
    await page.getByPlaceholder("Email").fill(`${unique}@example.com`);
    await page.getByPlaceholder("Username").fill(unique);
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign Up" }).click();

    // Accept either: successful redirect to /login, OR rate-limit error message on page
    await Promise.race([
      page.waitForURL(/\/login/, { timeout: 15_000 }),
      expect(page.getByText(/Too many signup attempts/)).toBeVisible({ timeout: 15_000 }),
    ]);
  });

  test("/u/profile redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/u/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("session persists after page refresh", async ({ page }) => {
    await loginAs(page, "alice");
    await page.reload();
    // Still logged in — private profile accessible
    await page.goto("/u/profile");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("body")).toContainText("Alice");
  });
});
