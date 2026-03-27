import type { Page } from "@playwright/test";

export const USERS = {
  alice: { email: "alice.example@example.com", password: "alice", username: "alice" },
  george: { email: "george.example@example.com", password: "george", username: "george" },
  dolores: { email: "dolores.example@example.com", password: "dolores", username: "dolores" },
} as const;

/**
 * Log in as a seeded user and wait for the redirect away from /login.
 * Uses full page reload (window.location.href) so waitForURL waits for navigation.
 */
export async function loginAs(page: Page, user: keyof typeof USERS) {
  const { email, password } = USERS[user];
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  // Login does window.location.href = callbackUrl (full page reload)
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });
}
