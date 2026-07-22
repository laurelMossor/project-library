import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";
import { switchToPage, switchToPersonal } from "./helpers/profile";

// Email-notification settings: the feature's primary user surface. Covers what unit tests can't reach —
// a real GET/PUT round-trip against the DB and the reload-on-identity-switch that shows each identity's
// own (independent) preferences. "Event RSVPs" is the probe category: it defaults OFF, so toggling it is
// an unambiguous change in either direction.
test.use({ storageState: STORAGE_STATE.alice });

const NOTIF_SETTINGS = "/settings/notifications";
const RSVPS = "Event RSVPs";

/** Click a category switch and wait for its PUT to land, so a reload can't race the save. */
async function toggleAndSave(page: Page, name: string) {
  const sw = page.getByRole("switch", { name });
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/me/notification-preferences") &&
        r.request().method() === "PUT" &&
        r.ok(),
    ),
    sw.click(),
  ]);
}

/** Ensure the RSVPS switch is in `want` state, saving if a change is needed. */
async function setRsvps(page: Page, want: boolean) {
  const sw = page.getByRole("switch", { name: RSVPS });
  await expect(sw).toBeVisible({ timeout: 10_000 });
  const isOn = (await sw.getAttribute("aria-checked")) === "true";
  if (isOn !== want) await toggleAndSave(page, RSVPS);
  await expect(sw).toHaveAttribute("aria-checked", want ? "true" : "false");
}

test.describe("Notification settings", () => {
  test("personal preferences round-trip through the API and persist across reload", async ({ page }) => {
    await page.goto(NOTIF_SETTINGS);
    const rsvps = page.getByRole("switch", { name: RSVPS });
    await expect(rsvps).toBeVisible({ timeout: 10_000 });
    await expect(rsvps).toHaveAttribute("aria-checked", "false"); // seed default: off

    await toggleAndSave(page, RSVPS);
    await expect(rsvps).toHaveAttribute("aria-checked", "true");

    await page.reload();
    await expect(page.getByRole("switch", { name: RSVPS })).toHaveAttribute("aria-checked", "true");

    // Restore the default so the sparse-row model isn't perturbed for later runs.
    await setRsvps(page, false);
  });

  test("preferences are independent per identity (personal vs managed page)", async ({ page }) => {
    // Personal: turn RSVPS on.
    await page.goto(NOTIF_SETTINGS);
    await setRsvps(page, true);

    // Switch to the guild identity from a page that has the nav, then open settings.
    await page.goto("/explore");
    await switchToPage(page, "Portland Makers Guild", "admin");
    await page.goto(NOTIF_SETTINGS);

    // The panel is scoped to the guild (the form's "Preferences for <name>" line names it — distinct
    // from the nav profile tag, which also shows the page name).
    await expect(page.getByText(/Preferences for/)).toContainText("Portland Makers Guild", { timeout: 10_000 });
    // ...and the guild's RSVPS is at its OWN default (off), unaffected by personal being on.
    await expect(page.getByRole("switch", { name: RSVPS })).toHaveAttribute("aria-checked", "false");

    // Cleanup: back to personal, restore RSVPS off.
    await page.goto("/explore");
    await switchToPersonal(page);
    await page.goto(NOTIF_SETTINGS);
    await setRsvps(page, false);
  });

  test("the settings menu links to email notifications", async ({ page }) => {
    await page.goto("/settings");
    const link = page.getByRole("link", { name: "Email Notifications" });
    await expect(link).toBeVisible({ timeout: 10_000 });
    await expect(link).toHaveAttribute("href", NOTIF_SETTINGS);
  });
});
