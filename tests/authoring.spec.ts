import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";
import { createPublishDelete, startDraft, type ContentKind } from "./helpers/content";

// All authoring happens as alice. Reuse her cached session instead of logging
// in through the UI in every test.
test.use({ storageState: STORAGE_STATE.alice });

test.describe("Authoring — create content", () => {
  // ─── Events & Posts share one create → publish → delete shape ──────────────
  // Parametrized so a regression in the inline-edit/save/publish/delete flow
  // fails on whichever surface broke, with no duplicated test body.
  for (const kind of ["event", "post"] as const satisfies readonly ContentKind[]) {
    const article = kind === "event" ? "an" : "a";
    test(`create, publish, and delete ${article} ${kind} (batched inline edit)`, async ({ page }) => {
      await createPublishDelete(page, kind);
    });
  }

  test("navigating away from a draft event deletes it", async ({ page }) => {
    const url = await startDraft(page, "event");
    const eventId = url.split("/events/")[1];

    const cleanupFired = page.waitForEvent("console", {
      predicate: (msg) => msg.text().includes("deleting draft event on navigation away"),
      timeout: 10_000,
    });

    // SPA navigation unmounts EventPageClient, triggering the empty-draft cleanup.
    await page.getByRole("link", { name: "Explore" }).click();
    await page.waitForURL(/\/explore/, { timeout: 10_000 });
    await cleanupFired;

    await page.waitForFunction(
      async (id) => (await fetch(`/api/events/${id}`)).status === 404,
      eventId,
      { timeout: 10_000, polling: 500 },
    );
  });

  test("draft post is not visible to the public", async ({ page, browser }) => {
    const postUrl = await startDraft(page, "post");

    // A fresh anonymous context must get the not-found page for the draft.
    const anonContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const anonPage = await anonContext.newPage();
      await anonPage.goto(postUrl);
      await expect(anonPage.getByRole("heading", { name: "Page not found" })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await anonContext.close();
    }

    // Clean up the draft (no publish/delete UI exercised here).
    await page.request.delete(`/api/posts/${postUrl.split("/posts/")[1]}`);
  });

  // ─── Pages ─────────────────────────────────────────────────────────────────
  test("a new page is created on open and kept once confirmed", async ({ page }) => {
    const handle = `playwright-test-${Date.now() % 1e7}`;
    await page.goto("/pages/new");
    await expect(page.getByRole("heading", { name: "Create a page", level: 1 })).toBeVisible();

    const handleField = page.getByLabel("Handle");
    await expect(handleField).toHaveValue("");
    const staged = (await (await page.request.get("/api/me/page")).json()).handle as string;
    // The staged handle is already taken. The one typed below is not, until confirm.
    const stagedRes = await page.request.get(`/api/handles/available?handle=${staged}`);
    expect((await stagedRes.json()).available).toBe(false);

    await handleField.fill(handle);
    await expect(page.getByText("Available")).toBeVisible();
    const free = await page.request.get(`/api/handles/available?handle=${handle}`);
    expect((await free.json()).available).toBe(true);

    await page.getByRole("button", { name: "Looks good" }).click();
    await page.waitForURL(new RegExp(`/${handle}$`), { timeout: 15_000 });
    // Left alone, the page name is the handle, and the staged handle is released.
    await expect(page.getByRole("heading", { name: handle, level: 1, exact: true })).toBeVisible();
    const taken = await page.request.get(`/api/handles/available?handle=${handle}`);
    expect((await taken.json()).available).toBe(false);
    const released = await page.request.get(`/api/handles/available?handle=${staged}`);
    expect((await released.json()).available).toBe(true);
  });

  test("leaving the new-page form deletes the staged page", async ({ page }) => {
    const handle = `playwright-test-${Date.now() % 1e7}x`;
    await page.goto("/pages/new");
    const handleField = page.getByLabel("Handle");
    await expect(handleField).toHaveValue("");
    const staged = (await (await page.request.get("/api/me/page")).json()).handle as string;
    await handleField.fill(handle);
    await expect(page.getByText("Available")).toBeVisible();

    await page.getByRole("link", { name: "Project Library" }).click();
    await page.waitForURL(/\/explore/);
    await expect.poll(async () => {
      const res = await page.request.get(`/api/handles/available?handle=${staged}`);
      return (await res.json()).available;
    }).toBe(true);
    const typed = await page.request.get(`/api/handles/available?handle=${handle}`);
    expect((await typed.json()).available).toBe(true);
  });

  test("cancel deletes the staged page", async ({ page }) => {
    await page.goto("/pages/new");
    const handleField = page.getByLabel("Handle");
    await expect(handleField).toHaveValue("");
    const staged = (await (await page.request.get("/api/me/page")).json()).handle as string;

    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForURL(/\/settings/);
    await expect.poll(async () => {
      const res = await page.request.get(`/api/handles/available?handle=${staged}`);
      return (await res.json()).available;
    }).toBe(true);
  });

  // ─── Profile inline editing ──────────────────────────────────────────────
  // Deep-link straight into edit mode (?edit=true) so the editable affordance
  // is guaranteed present — the previous version guarded the whole body in an
  // `if (isVisible())` that never ran (alice has a seeded headline, so the
  // "Add a headline" placeholder this looked for was never rendered).
  test("owner can inline-edit their profile and cancel without saving", async ({ page }) => {
    await page.goto("/alice.example?edit=true");

    // alice's seeded headline renders as the clickable edit affordance.
    const headlineField = page.getByRole("button", { name: /Quilter & Textile Artist/i });
    await expect(headlineField).toBeVisible({ timeout: 10_000 });
    await headlineField.click();

    const headlineInput = page.getByPlaceholder("Add a headline");
    await expect(headlineInput).toBeVisible();
    await headlineInput.fill("Test headline from Playwright");
    await page.keyboard.press("Escape");

    // The edit dirties the batched session.
    await expect(page.getByText(/unsaved change/)).toBeVisible();

    // Cancel discards the change — no save, no DB mutation.
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/unsaved change/)).not.toBeVisible();
  });
});
