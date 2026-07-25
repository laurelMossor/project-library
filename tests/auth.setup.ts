import "./env";
import { test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loginAs, STORAGE_STATE, type SeededUser } from "./helpers/auth";

/**
 * Setup project (runs once, before the chromium project, after the webServer
 * is up). Logs in alice and sam through the real UI and saves their session
 * cookies. Authenticated specs then load these via `test.use({ storageState })`
 * instead of repeating the login flow in every test — a large speed win since
 * the suite runs serially (workers: 1) against a shared DB.
 *
 * The states are captured against the freshly seeded DB, so the session JWTs
 * (userId, tokenVersion) always match the current seed.
 */
for (const user of ["alice", "sam"] as const satisfies readonly SeededUser[]) {
  setup(`authenticate as ${user}`, async ({ page }) => {
    await loginAs(page, user);
    const path = STORAGE_STATE[user];
    mkdirSync(dirname(path), { recursive: true });
    await page.context().storageState({ path });
  });
}
