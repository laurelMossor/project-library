import "./env";
import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createSignupInvite } from "../src/lib/utils/server/signup-invite";
import { SIGNUP_WITH_INVITE, FORGOT_PASSWORD, RESET_PASSWORD_WITH_TOKEN, VERIFY_EMAIL_WITH_TOKEN } from "../src/lib/const/routes";
import { prisma } from "../src/lib/utils/server/prisma";
import { createUser } from "../src/lib/utils/server/user";
import { createPasswordResetToken, createEmailVerificationToken } from "../src/lib/utils/server/auth-tokens";
import { loginAs, submitLogin, USERS } from "./helpers/auth";

// Auth-flow tests run anonymously (no stored session — they exercise login
// itself). A unique-per-run X-Forwarded-For gives every browser request its
// own rate-limit bucket, so the signup test asserts real success instead of
// "succeeded OR was rate-limited" (the in-memory limit is keyed on client IP).
const RUN_IP = `10.${(Date.now() >> 16) & 255}.${(Date.now() >> 8) & 255}.${Date.now() & 255}`;
test.use({ extraHTTPHeaders: { "x-forwarded-for": RUN_IP } });

test.describe("Authentication flows", () => {
  test("valid login redirects away from /login", async ({ page }) => {
    await loginAs(page, "alice");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("invalid login shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await submitLogin(page, USERS.alice.email, "wrongpassword");
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("signup with a valid invite redirects to the check-inbox page", async ({ page }) => {
    // "tst" prefix matches the teardown; the auto-generated handle derives from the
    // email local-part, so it also starts with "tst" and is cleaned up.
    const unique = `tst${Date.now() % 1e7}`;
    const email = `${unique}@example.com`;
    const { rawToken } = await createSignupInvite(email);

    await page.goto(SIGNUP_WITH_INVITE(rawToken));
    await page.getByPlaceholder("Email").fill(email);
    // Signup no longer collects a handle — one is auto-generated from the email server-side.
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign Up" }).click();

    await page.waitForURL(/\/verify-email\/check-inbox/, { timeout: 15_000 });
  });

  test("/settings redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("session persists across a page refresh", async ({ page }) => {
    await loginAs(page, "alice");
    await page.reload();
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

test.describe("Email verification + password reset", () => {
  test("unverified user is blocked from logging in and offered a resend", async ({ page }) => {
    const unique = `unv${Date.now() % 1e7}`;
    const email = `${unique}@example.com`;
    // Unverified account (emailVerified defaults to null).
    await createUser({ email, handle: unique, passwordHash: await bcrypt.hash("password123", 10) });

    try {
      await page.goto("/login");
      await submitLogin(page, email, "password123");

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText(/verify your email/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /resend verification/i })).toBeVisible();
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  test("email verification needs a deliberate click, then unblocks login", async ({ page }) => {
    const unique = `ver${Date.now() % 1e7}`;
    const email = `${unique}@example.com`;
    const { userId } = await createUser({
      email,
      handle: unique,
      passwordHash: await bcrypt.hash("password123", 10),
    });

    try {
      const { rawToken } = await createEmailVerificationToken(userId);
      const confirmButton = page.getByRole("button", { name: /confirm my email/i });

      // Visiting the link does NOT auto-verify — a scanner's GET must not burn it.
      await page.goto(VERIFY_EMAIL_WITH_TOKEN(rawToken));
      await expect(confirmButton).toBeVisible();
      // Reloading still shows the button (token not yet consumed).
      await page.reload();
      await expect(confirmButton).toBeVisible();

      // Deliberate click consumes the token and verifies the account.
      await confirmButton.click();
      await expect(page.getByText(/email verified/i)).toBeVisible();

      // Login now succeeds.
      await page.goto("/login");
      await submitLogin(page, email, "password123");
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
      // Mint a real reset token (DB stores only its hash, so this is the only
      // way to get the raw token the link carries).
      const { rawToken } = await createPasswordResetToken(userId);

      await page.goto(RESET_PASSWORD_WITH_TOKEN(rawToken));
      await page.getByPlaceholder("New password", { exact: true }).fill("brandnewpass123");
      await page.getByPlaceholder("Confirm new password").fill("brandnewpass123");
      await page.getByRole("button", { name: /reset password/i }).click();

      // Lands on login; the NEW password works.
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      await submitLogin(page, email, "brandnewpass123");
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  test("forgot-password submits without revealing whether the account exists", async ({ page }) => {
    await page.goto(FORGOT_PASSWORD);
    await page.getByPlaceholder("Email").fill("definitely-nobody@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/we've sent a reset link/i)).toBeVisible();
  });
});
