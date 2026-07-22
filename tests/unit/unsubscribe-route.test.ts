/**
 * Route test for POST /api/unsubscribe. Mocks the token verifier + preference writer; asserts a valid
 * token flips only that identity's master, an invalid token 400s without writing, and page vs personal
 * labels resolve.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: { page: { findUnique: vi.fn() } } }));
vi.mock("@/lib/utils/server/unsubscribe-token", () => ({ verifyUnsubscribeToken: vi.fn() }));
vi.mock("@/lib/utils/server/notification-preferences", () => ({ setMaster: vi.fn() }));

import { POST } from "@/app/api/unsubscribe/route";
import { verifyUnsubscribeToken } from "@/lib/utils/server/unsubscribe-token";
import { setMaster } from "@/lib/utils/server/notification-preferences";
import { prisma } from "@/lib/utils/server/prisma";

const verify = vi.mocked(verifyUnsubscribeToken);
const setMasterMock = vi.mocked(setMaster);

function req(body: unknown) {
	return new Request("http://test/api/unsubscribe", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
	vi.clearAllMocks();
	setMasterMock.mockResolvedValue(undefined as never);
});

describe("POST /api/unsubscribe", () => {
	test("invalid token → 400, no master write", async () => {
		verify.mockReturnValue(null);
		const res = await POST(req({ token: "bad" }));
		expect(res.status).toBe(400);
		expect(setMasterMock).not.toHaveBeenCalled();
	});

	test("valid personal token flips that identity's master off", async () => {
		verify.mockReturnValue({ recipientUserId: "alice", contextPageId: null });
		const res = await POST(req({ token: "good" }));
		const json = await res.json();
		expect(res.status).toBe(200);
		expect(json).toMatchObject({ ok: true, label: "your personal" });
		expect(setMasterMock).toHaveBeenCalledWith({ recipientUserId: "alice", contextPageId: null }, false);
	});

	test("valid page token resolves the page name and flips the page-context master", async () => {
		verify.mockReturnValue({ recipientUserId: "alice", contextPageId: "pageX" });
		vi.mocked(prisma.page.findUnique).mockResolvedValue({ name: "Repair Café" } as never);
		const res = await POST(req({ token: "good" }));
		const json = await res.json();
		expect(json).toMatchObject({ ok: true, label: "Repair Café" });
		expect(setMasterMock).toHaveBeenCalledWith({ recipientUserId: "alice", contextPageId: "pageX" }, false);
	});
});
