import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "./helpers/auth";

// Group messaging, end to end through the UI. Groups are named "PW group …" and messages start with
// "Hello from Playwright" so global-teardown removes them.
test.use({ storageState: STORAGE_STATE.alice });

const COMPOSER = /Type a message/;

test.describe("Group messaging", () => {
	test("create a group → send → the other member reads it", async ({ page, browser }) => {
		const groupName = `PW group ${Date.now()}`;
		const content = `Hello from Playwright (group) ${Date.now()}`;

		// Alice: New group → pick sam from her follow-connected suggestions → name it → create.
		await page.goto("/messages");
		await page.getByRole("button", { name: "+ New group" }).click();
		await page.getByRole("button", { name: /Sam Example.*@sam\.example/ }).click();
		await page.getByPlaceholder("e.g. Garden crew").fill(groupName);
		await page.getByRole("button", { name: "Create group" }).click();

		// The new group opens as a thread; send into it.
		await expect(page.getByRole("heading", { name: groupName })).toBeVisible({ timeout: 10_000 });
		await page.getByPlaceholder(COMPOSER).fill(content);
		await page.getByRole("button", { name: "Send" }).click();
		await expect(page.getByText(content)).toBeVisible({ timeout: 10_000 });

		// Sam: the group is in his inbox, unread; opening it shows alice's message attributed to her.
		const samCtx = await browser.newContext({ storageState: STORAGE_STATE.sam });
		try {
			const sam = await samCtx.newPage();
			await sam.goto("/messages");
			const row = sam.getByRole("button", { name: new RegExp(groupName) });
			await expect(row).toBeVisible({ timeout: 10_000 });
			await expect(row.getByLabel("1 unread")).toBeVisible();

			await row.click();
			// Attribution is checked on the message itself, not anywhere on the page.
			const bubble = sam.getByRole("listitem").filter({ hasText: content });
			await expect(bubble).toBeVisible({ timeout: 10_000 });
			await expect(bubble.getByText("Alice Example", { exact: true })).toBeVisible();

			// Reading clears sam's unread for the group.
			await sam.goto("/messages");
			await expect(sam.getByRole("button", { name: new RegExp(groupName) }).getByLabel(/unread/)).toHaveCount(0);
		} finally {
			await samCtx.close();
		}
	});

	test("messaging someone you share a group with opens your DM, not the group", async ({ page }) => {
		const groupName = `PW group ${Date.now()}`;

		// Alice and sam share a (fresh) group…
		await page.goto("/messages");
		await page.getByRole("button", { name: "+ New group" }).click();
		await page.getByRole("button", { name: /Sam Example.*@sam\.example/ }).click();
		await page.getByPlaceholder("e.g. Garden crew").fill(groupName);
		await page.getByRole("button", { name: "Create group" }).click();
		await expect(page.getByRole("heading", { name: groupName })).toBeVisible({ timeout: 10_000 });

		// …yet Message on sam's profile resolves to their existing DM (seeded history), never the group.
		await page.goto("/sam.example");
		await page.getByRole("link", { name: "Message" }).click();
		await page.waitForURL(/\/messages\/u\/[^/]+$/, { timeout: 10_000 });
		await expect(page.getByText("Saw your raised bed post")).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole("heading", { name: groupName })).toHaveCount(0);
	});
});
