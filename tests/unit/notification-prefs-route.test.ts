/**
 * Email-preference settings: the GET route (the panel's load) and updateNotificationPrefsAction (its save).
 * Mocks the session, the page-permission check, and prisma; lets the real identity resolution and patch
 * validation run. Asserts identity scoping (personal vs page, with the manage gate), validation, and that
 * master/category writes land on the right (user, context) rows.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const tx = { notificationPreference: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } };

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		notificationPreference: { findMany: vi.fn() },
		$transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { GET } from "@/app/api/me/notification-preferences/route";
import { updateNotificationPrefsAction } from "@/lib/actions/settings";
import { getSessionContext } from "@/lib/utils/server/session";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { prisma } from "@/lib/utils/server/prisma";

const session = vi.mocked(getSessionContext);
const canPost = vi.mocked(canPostAsPage);

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([] as never);
	tx.notificationPreference.findFirst.mockResolvedValue(null);
});

describe("GET /api/me/notification-preferences", () => {
	test("unauthenticated → 401", async () => {
		session.mockResolvedValue(null);
		expect((await GET()).status).toBe(401);
	});

	test("personal identity reads the user's own rows (contextPageId null)", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		const res = await GET();
		expect(res.status).toBe(200);
		expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: "alice", contextPageId: null } }),
		);
	});

	test("acting as a managed page reads that page's rows for this user", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: "pageX" });
		canPost.mockResolvedValue(true);
		await GET();
		expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: "alice", contextPageId: "pageX" } }),
		);
	});

	test("acting as a page you don't manage → 403", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: "pageX" });
		canPost.mockResolvedValue(false);
		expect((await GET()).status).toBe(403);
	});
});

describe("updateNotificationPrefsAction", () => {
	test("anonymous → unauthorized, nothing written", async () => {
		session.mockResolvedValue(null);
		const result = await updateNotificationPrefsAction({ master: false });
		expect(result).toMatchObject({ ok: false, error: "unauthorized" });
		expect(tx.notificationPreference.create).not.toHaveBeenCalled();
	});

	test("writes master + category prefs for the personal identity and returns the effective prefs", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		const result = await updateNotificationPrefsAction({ master: false, categories: { COMMENTS: false, RSVPS: true } });
		expect(result.ok).toBe(true);
		const created = tx.notificationPreference.create.mock.calls.map(([arg]) => arg.data);
		expect(created).toEqual([
			{ userId: "alice", contextPageId: null, category: null, enabled: false },
			{ userId: "alice", contextPageId: null, category: "COMMENTS", enabled: false },
			{ userId: "alice", contextPageId: null, category: "RSVPS", enabled: true },
		]);
		if (result.ok) expect(result.data.categories).toHaveProperty("RSVPS");
	});

	test("acting as a managed page writes that page's context", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: "pageX" });
		canPost.mockResolvedValue(true);
		await updateNotificationPrefsAction({ master: true });
		expect(tx.notificationPreference.create.mock.calls[0][0].data).toMatchObject({
			userId: "alice",
			contextPageId: "pageX",
		});
	});

	test("acting as a page you don't manage → forbidden, nothing written", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: "pageX" });
		canPost.mockResolvedValue(false);
		const result = await updateNotificationPrefsAction({ master: true });
		expect(result).toMatchObject({ ok: false, error: "forbidden" });
		expect(tx.notificationPreference.create).not.toHaveBeenCalled();
	});

	test("unknown category → invalid, nothing written", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		const result = await updateNotificationPrefsAction({ master: false, categories: { BOGUS: true } });
		expect(result).toMatchObject({ ok: false, error: "invalid" });
		expect(tx.notificationPreference.create).not.toHaveBeenCalled();
	});

	test("non-boolean master → invalid", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		const result = await updateNotificationPrefsAction({ master: "yes" as never });
		expect(result).toMatchObject({ ok: false, error: "invalid" });
	});
});
