/**
 * setActivePageAction: the server-side gate for profile switching (was PUT/DELETE /api/session/active-page).
 * The session, the page-permission check, and NextAuth's server-side update are mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ unstable_update: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn(), canSetActivePage: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { setActivePageAction } from "@/lib/actions/session";
import { unstable_update } from "@/lib/auth";
import { canSetActivePage, getSessionContext } from "@/lib/utils/server/session";
import { refresh } from "next/cache";

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getSessionContext).mockResolvedValue({ userId: "user-abc", activePageId: null });
});

describe("setActivePageAction", () => {
	test("unauthenticated → unauthorized, session untouched", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null);
		expect(await setActivePageAction({ pageId: "page-1" })).toMatchObject({ ok: false, error: "unauthorized" });
		expect(unstable_update).not.toHaveBeenCalled();
	});

	test("non-string page id → invalid", async () => {
		const result = await setActivePageAction({ pageId: 42 as never });
		expect(result).toMatchObject({ ok: false, error: "invalid" });
		expect(unstable_update).not.toHaveBeenCalled();
	});

	test("user cannot act as the page → forbidden with the message, session untouched", async () => {
		vi.mocked(canSetActivePage).mockResolvedValue(false);
		const result = await setActivePageAction({ pageId: "page-1" });
		expect(result).toEqual({ ok: false, error: "forbidden", message: "You cannot act as this page" });
		expect(unstable_update).not.toHaveBeenCalled();
	});

	test("allowed → validates against the caller's userId, writes the session, refreshes", async () => {
		vi.mocked(canSetActivePage).mockResolvedValue(true);
		const result = await setActivePageAction({ pageId: "page-xyz" });
		expect(result.ok).toBe(true);
		expect(canSetActivePage).toHaveBeenCalledWith("user-abc", "page-xyz");
		expect(unstable_update).toHaveBeenCalledWith({ activePageId: "page-xyz" });
		expect(refresh).toHaveBeenCalled();
	});

	test("null → back to the personal identity without a page check", async () => {
		const result = await setActivePageAction({ pageId: null });
		expect(result.ok).toBe(true);
		expect(canSetActivePage).not.toHaveBeenCalled();
		expect(unstable_update).toHaveBeenCalledWith({ activePageId: null });
	});
});
