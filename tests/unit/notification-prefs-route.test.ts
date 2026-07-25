/**
 * Route test for GET/PUT /api/me/notification-preferences. Mocks the session, the page-permission check,
 * and the preference layer; asserts identity scoping (personal vs page, with the manage gate), body
 * validation, and that master/category writes are dispatched.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn() }));
vi.mock("@/lib/utils/server/notification-preferences", () => ({
	getEffectivePrefs: vi.fn(),
	setMaster: vi.fn(),
	setPref: vi.fn(),
}));

import { GET, PUT } from "@/app/api/me/notification-preferences/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { getEffectivePrefs, setMaster, setPref } from "@/lib/utils/server/notification-preferences";

const session = vi.mocked(getSessionContext);
const canPost = vi.mocked(canPostAsPage);
const effective = vi.mocked(getEffectivePrefs);

function putReq(body: unknown) {
	return new Request("http://test/api/me/notification-preferences", { method: "PUT", body: JSON.stringify(body) });
}

beforeEach(() => {
	vi.clearAllMocks();
	effective.mockResolvedValue({ master: true, categories: {} } as never);
	vi.mocked(setMaster).mockResolvedValue(undefined as never);
	vi.mocked(setPref).mockResolvedValue(undefined as never);
});

describe("GET /api/me/notification-preferences", () => {
	test("unauthenticated → 401", async () => {
		session.mockResolvedValue(null);
		expect((await GET()).status).toBe(401);
	});

	test("personal identity reads prefs for the user (contextPageId null)", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		await GET();
		expect(effective).toHaveBeenCalledWith({ recipientUserId: "alice", contextPageId: null });
	});

	test("acting as a managed page reads that page's prefs for this user", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: "pageX" });
		canPost.mockResolvedValue(true);
		await GET();
		expect(effective).toHaveBeenCalledWith({ recipientUserId: "alice", contextPageId: "pageX" });
	});

	test("acting as a page you don't manage → 403", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: "pageX" });
		canPost.mockResolvedValue(false);
		expect((await GET()).status).toBe(403);
	});
});

describe("PUT /api/me/notification-preferences", () => {
	test("writes master + category prefs for the active identity", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		await PUT(putReq({ master: false, categories: { COMMENTS: false, RSVPS: true } }));
		expect(setMaster).toHaveBeenCalledWith({ recipientUserId: "alice", contextPageId: null }, false);
		expect(setPref).toHaveBeenCalledWith({ recipientUserId: "alice", contextPageId: null }, "COMMENTS", false);
		expect(setPref).toHaveBeenCalledWith({ recipientUserId: "alice", contextPageId: null }, "RSVPS", true);
	});

	test("unknown category → 400, nothing written", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		const res = await PUT(putReq({ categories: { BOGUS: true } }));
		expect(res.status).toBe(400);
		expect(setPref).not.toHaveBeenCalled();
	});

	test("non-boolean master → 400", async () => {
		session.mockResolvedValue({ userId: "alice", activePageId: null });
		const res = await PUT(putReq({ master: "yes" }));
		expect(res.status).toBe(400);
	});
});
