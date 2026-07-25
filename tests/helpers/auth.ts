import { resolve } from "node:path";
import type { Page } from "@playwright/test";

export const USERS = {
  alice: { email: "alice@example.com", password: "alice", handle: "alice.example" },
  sam: { email: "sam@example.com", password: "sam", handle: "sam.example" },
} as const;

export type SeededUser = keyof typeof USERS;

/** Saved-session files written by tests/auth.setup.ts and reused via test.use(). */
export const STORAGE_STATE: Record<SeededUser, string> = {
  alice: resolve(process.cwd(), "tests/.auth/alice.json"),
  sam: resolve(process.cwd(), "tests/.auth/sam.json"),
};

/**
 * Fill and submit the login form for an already-loaded /login page.
 * Shared by loginAs and by the negative auth-flow tests.
 */
export async function submitLogin(page: Page, email: string, password: string) {
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
}

/**
 * Log in as a seeded user through the real UI and wait for the redirect away
 * from /login. Used by auth.setup.ts to mint storage states and by the
 * auth-flow tests that must exercise the live login path. Most specs should
 * prefer `test.use({ storageState: STORAGE_STATE.alice })` over calling this.
 *
 * Login does window.location.href = callbackUrl (full page reload), so
 * waitForURL waits for the navigation.
 */
export async function loginAs(page: Page, user: SeededUser) {
  const { email, password } = USERS[user];
  await page.goto("/login");
  await submitLogin(page, email, password);
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}
