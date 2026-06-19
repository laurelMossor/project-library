import "./env";
import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createSignupInvite } from "../src/lib/utils/server/signup-invite";
import { SIGNUP_WITH_INVITE, FORGOT_PASSWORD, RESET_PASSWORD_WITH_TOKEN, VERIFY_EMAIL_WITH_TOKEN } from "../src/lib/const/routes";
import { prisma } from "../src/lib/utils/server/prisma";
import { createUser } from "../src/lib/utils/server/user";
import { createPasswordResetToken, createEmailVerificationToken } from "../src/lib/utils/server/auth-tokens";
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
    const email = `${unique}@example.com`;
    const devBypass = process.env.DEV_SIGNUP_BYPASS_SECRET?.trim();
    if (devBypass && devBypass.length >= 20) {
      await page.goto(SIGNUP_WITH_INVITE(devBypass));
    } else {
      const { rawToken } = await createSignupInvite(email);
      await page.goto(SIGNUP_WITH_INVITE(rawToken));
    }
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Handle").fill(unique);
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign Up" }).click();

    // Accept either: successful redirect to the verify-email check-inbox page,
    // OR rate-limit error message on page.
    await Promise.race([
      page.waitForURL(/\/verify-email\/check-inbox/, { timeout: 15_000 }),
      expect(page.getByText(/Too many signup attempts/)).toBeVisible({ timeout: 15_000 }),
    ]);
  });

  test("/settings redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("session persists after page refresh", async ({ page }) => {
    await loginAs(page, "alice");
    await page.reload();
    // Still logged in — settings page accessible
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

test.describe("Email verification + password reset", () => {
  test("unverified user is blocked from logging in and offered a resend", async ({ page }) => {
    const unique = `unv${Date.now() % 1e7}`;
    const email = `${unique}@example.com`;
    // Create an unverified account directly (emailVerified defaults to null).
    await createUser({
      email,
      handle: unique,
      passwordHash: await bcrypt.hash("password123", 10),
    });

    try {
      await page.goto("/login");
      await page.getByPlaceholder("Email").fill(email);
      await page.getByPlaceholder("Password").fill("password123");
      await page.getByRole("button", { name: "Log In" }).click();

      // Login is blocked: still on /login, with the verify message + resend.
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText(/verify your email/i)).toBeVisible();
      await expect(
        page.getByRole("button", { name: /resend verification/i }),
      ).toBeVisible();
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  test("email verification needs a deliberate click, then unblocks login", async ({ page }) => {
    const unique = `ver${Date.now() % 1e7}`;
    const email = `${unique}@example.com`;
    // Unverified account (emailVerified defaults to null).
    const { userId } = await createUser({
      email,
      handle: unique,
      passwordHash: await bcrypt.hash("password123", 10),
    });

    try {
      const { rawToken } = await createEmailVerificationToken(userId);

      // Visiting the link does NOT auto-verify — a scanner's GET must not burn it.
      await page.goto(VERIFY_EMAIL_WITH_TOKEN(rawToken));
      await expect(page.getByRole("button", { name: /confirm my email/i })).toBeVisible();
      // Reloading still shows the button (token not yet consumed).
      await page.reload();
      await expect(page.getByRole("button", { name: /confirm my email/i })).toBeVisible();

      // Deliberate click consumes the token and verifies the account.
      await page.getByRole("button", { name: /confirm my email/i }).click();
      await expect(page.getByText(/email verified/i)).toBeVisible();

      // Login now succeeds.
      await page.goto("/login");
      await page.getByPlaceholder("Email").fill(email);
      await page.getByPlaceholder("Password").fill("password123");
      await page.getByRole("button", { name: "Log In" }).click();
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  test("password reset loop: reset link → new password → log in", async ({ page }) => {
    const unique = `rst${Date.now() % 1e7}`;
    const email = `${unique}@example.com`;
    const { userId } = await createUser({
      email,
      handle: unique,
      passwordHash: await bcrypt.hash("oldpassword123", 10),
      emailVerified: new Date(), // verified, so login isn't gated
    });

    try {
      // Mint a real reset token (writes the DB row, returns the raw token —
      // the DB only stores its hash, so this is the only way to get the raw).
      const { rawToken } = await createPasswordResetToken(userId);

      await page.goto(RESET_PASSWORD_WITH_TOKEN(rawToken));
      await page.getByPlaceholder("New password", { exact: true }).fill("brandnewpass123");
      await page.getByPlaceholder("Confirm new password").fill("brandnewpass123");
      await page.getByRole("button", { name: /reset password/i }).click();

      // Lands back on login; now log in with the NEW password.
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      await page.getByPlaceholder("Email").fill(email);
      await page.getByPlaceholder("Password").fill("brandnewpass123");
      await page.getByRole("button", { name: "Log In" }).click();
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  test("forgot-password page submits without revealing account existence", async ({ page }) => {
    await page.goto(FORGOT_PASSWORD);
    await page.getByPlaceholder("Email").fill("definitely-nobody@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    // Neutral confirmation regardless of whether the account exists.
    await expect(page.getByText(/we've sent a reset link/i)).toBeVisible();
  });
});
