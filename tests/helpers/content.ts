import { expect, type Page } from "@playwright/test";

export type ContentKind = "event" | "post";

interface ContentConfig {
  newRoute: string;
  /** Matches the detail URL the /new route redirects the draft to. */
  detailUrl: RegExp;
  title: { label: RegExp; placeholder: string; value: string };
  body: { label: RegExp; placeholder: string; value: string };
  /** Two-step delete trigger label ("Delete Event" / "Delete Post"). */
  deleteButton: string;
}

/**
 * Per-kind locators for the inline authoring flow. Events and posts share an
 * identical create → inline-edit → save → publish → delete shape; only the
 * field labels/placeholders and the delete-button text differ. Keeping the
 * config here lets one parametrized spec cover both surfaces.
 */
export const CONTENT: Record<ContentKind, ContentConfig> = {
  event: {
    newRoute: "/events/new",
    detailUrl: /\/events\/[^/]+$/,
    title: { label: /Event name/i, placeholder: "Event name", value: "Playwright Test Event" },
    body: {
      label: /What should people know/i,
      placeholder: "What should people know?",
      value: "This event was created by an automated test.",
    },
    deleteButton: "Delete Event",
  },
  post: {
    newRoute: "/posts/new",
    detailUrl: /\/posts\/(?!new$)[^/]+$/,
    title: { label: /Title \(optional\)/i, placeholder: "Title (optional)", value: "Playwright Test Post" },
    body: {
      label: /What are you working on/i,
      placeholder: "What are you working on or thinking about?",
      value: "This post was created by an automated test.",
    },
    deleteButton: "Delete Post",
  },
};

/**
 * Open the /new route and wait for the auto-created DRAFT's detail page.
 * Returns the draft's detail URL. Asserts the draft-only banner so callers
 * know editing surface is live.
 */
export async function startDraft(page: Page, kind: ContentKind): Promise<string> {
  const cfg = CONTENT[kind];
  await page.goto(cfg.newRoute);
  await page.waitForURL(cfg.detailUrl, { timeout: 15_000 });
  await expect(page.getByText("Draft — only you can see this")).toBeVisible();
  return page.url();
}

/** Open an inline field, type a value, and Escape — the value persists in the dirty session. */
async function fillInlineField(page: Page, label: RegExp, placeholder: string, value: string) {
  await page.getByRole("button", { name: label }).first().click();
  await page.getByPlaceholder(placeholder).fill(value);
  await page.keyboard.press("Escape");
}

/**
 * Full authoring round-trip for one content kind: create a draft, inline-edit
 * title + body, batch-save, publish, then delete via the two-step confirm.
 * Asserts each transition (dirty → saved → live → removed) so a regression in
 * any step fails loudly. Leaves no DB artifact (deletes what it created).
 */
export async function createPublishDelete(page: Page, kind: ContentKind) {
  const cfg = CONTENT[kind];
  await startDraft(page, kind);

  // Inline-edit title and body; each edit dirties the batched session.
  await fillInlineField(page, cfg.title.label, cfg.title.placeholder, cfg.title.value);
  await expect(page.getByText("1 unsaved change")).toBeVisible();
  await fillInlineField(page, cfg.body.label, cfg.body.placeholder, cfg.body.value);
  await expect(page.getByText(/unsaved change/)).toBeVisible();

  // Save (exact — the bar also offers "Save and publish").
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(cfg.title.value)).toBeVisible();
  await expect(page.getByText(/unsaved change/)).not.toBeVisible({ timeout: 10_000 });

  // Publish — enabled only once there are no dirty fields.
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Live")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Draft — only you can see this")).not.toBeVisible();

  // Delete — two-step confirm, redirects to /explore.
  await page.getByRole("button", { name: cfg.deleteButton }).click();
  await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/explore/, { timeout: 10_000 });
}
