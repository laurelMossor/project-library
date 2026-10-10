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

    // SPA navigation unmounts EventPageClient, triggering the empty-draft cleanup.
    await page.getByRole("link", { name: "Explore" }).click();
    await page.waitForURL(/\/explore/, { timeout: 10_000 });

    // The draft's own page 404s once the cleanup action has deleted it.
    await page.waitForFunction(
      async (draftUrl) => (await fetch(draftUrl)).status === 404,
      url,
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

    // Clean up: leaving an empty draft discards it.
    await page.getByRole("link", { name: "Explore" }).click();
    await page.waitForFunction(
      async (draftUrl) => (await fetch(draftUrl)).status === 404,
      postUrl,
      { timeout: 10_000, polling: 500 },
    );
  });

  // ─── Pages ─────────────────────────────────────────────────────────────────
  test("a new page is created only when confirmed", async ({ page }) => {
    const handle = `playwright-test-${Date.now() % 1e7}`;
    const before = await page.request.get("/api/me/pages");
    const beforeCount = (await before.json() as unknown[]).length;

    await page.goto("/pages/new");
    await expect(page.getByRole("heading", { name: "Create a page", level: 1 })).toBeVisible();
    await expect(page.getByText("Alice Example")).toBeVisible();

    const handleField = page.getByLabel("Handle");
    await expect(handleField).toHaveValue("");
    await handleField.fill(handle);
    await expect(page.getByText("Available")).toBeVisible();
    const free = await page.request.get(`/api/handles/available?handle=${handle}`);
    expect((await free.json()).available).toBe(true);

    const mid = await page.request.get("/api/me/pages");
    expect((await mid.json() as unknown[]).length).toBe(beforeCount);

    await page.getByRole("button", { name: "Looks good" }).click();
    await page.waitForURL(new RegExp(`/${handle}$`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: handle, level: 1, exact: true })).toBeVisible();
    const taken = await page.request.get(`/api/handles/available?handle=${handle}`);
    expect((await taken.json()).available).toBe(false);
    const after = await page.request.get("/api/me/pages");
    expect((await after.json() as unknown[]).length).toBe(beforeCount + 1);
  });

  test("leaving the new-page form creates nothing", async ({ page }) => {
    const handle = `playwright-test-${Date.now() % 1e7}x`;
    const before = await page.request.get("/api/me/pages");
    const beforeCount = (await before.json() as unknown[]).length;

    await page.goto("/pages/new");
    const handleField = page.getByLabel("Handle");
    await expect(handleField).toHaveValue("");
    await handleField.fill(handle);
    await expect(page.getByText("Available")).toBeVisible();

    await page.getByRole("link", { name: "Project Library" }).click();
    await page.waitForURL(/\/explore/);
    const typed = await page.request.get(`/api/handles/available?handle=${handle}`);
    expect((await typed.json()).available).toBe(true);
    const after = await page.request.get("/api/me/pages");
    expect((await after.json() as unknown[]).length).toBe(beforeCount);
  });

  test("cancel creates nothing", async ({ page }) => {
    const before = await page.request.get("/api/me/pages");
    const beforeCount = (await before.json() as unknown[]).length;

    await page.goto("/pages/new");
    await expect(page.getByLabel("Handle")).toHaveValue("");

    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForURL(/\/settings/);
    const after = await page.request.get("/api/me/pages");
    expect((await after.json() as unknown[]).length).toBe(beforeCount);
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
