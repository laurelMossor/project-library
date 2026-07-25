/**
 * Unit tests for the email fan-out in POST /api/messages. Mocks the session, prisma, the page-permission
 * reader, and the enqueue seam; uses the real validators + error helpers. Asserts the identity-scoping
 * that a generic reviewer can't see: a direct message enqueues one personal row; a page message fans out
 * to ADMIN/EDITOR managers only (MEMBERs and the sender excluded), each tagged with the page context;
 * and an enqueue failure never fails the 201.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn(), getResourcePermissions: vi.fn() }));
vi.mock("@/lib/utils/server/email-outbox", () => ({ enqueueEmails: vi.fn() }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		user: { findUnique: vi.fn() },
		page: { findUnique: vi.fn() },
		conversationParticipant: { findMany: vi.fn(), findFirst: vi.fn() },
		conversation: { create: vi.fn(), update: vi.fn() },
		message: { create: vi.fn() },
	},
}));

import { POST } from "@/app/api/messages/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { getResourcePermissions } from "@/lib/utils/server/permission";
import { enqueueEmails } from "@/lib/utils/server/email-outbox";
import { prisma } from "@/lib/utils/server/prisma";

const session = vi.mocked(getSessionContext);
const resourcePerms = vi.mocked(getResourcePermissions);
const enqueue = vi.mocked(enqueueEmails);

function req(body: unknown) {
	return new Request("http://test/api/messages", { method: "POST", body: JSON.stringify(body) });
}

/** The entries handed to the most recent enqueueEmails call. */
function enqueuedEntries(): any[] {
	return (enqueue.mock.calls.at(-1)?.[0] as any[]) ?? [];
}

beforeEach(() => {
	vi.clearAllMocks();
	session.mockResolvedValue({ userId: "alice", activePageId: null } as never);
	// No existing conversation → a fresh one is created.
	vi.mocked(prisma.conversationParticipant.findMany).mockResolvedValue([] as never);
	vi.mocked(prisma.conversationParticipant.findFirst).mockResolvedValue(null as never);
	vi.mocked(prisma.conversation.create).mockResolvedValue({ id: "conv1" } as never);
	vi.mocked(prisma.conversation.update).mockResolvedValue({} as never);
	vi.mocked(prisma.message.create).mockResolvedValue({
		id: "msg1", conversationId: "conv1", senderId: "alice", asPageId: null, content: "Hi there", createdAt: new Date(), readAt: null,
	} as never);
	vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "bob" } as never);
	vi.mocked(prisma.page.findUnique).mockResolvedValue({ id: "pageY" } as never);
	enqueue.mockResolvedValue(undefined as never);
});

describe("POST /api/messages email fan-out", () => {
	test("direct user message → one personal MESSAGES row for the recipient", async () => {
		const res = await req({ recipientUserId: "bob", content: "Hi there" });
		const response = await POST(res);
		expect(response.status).toBe(201);

		const entries = enqueuedEntries();
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			recipientUserId: "bob",
			contextPageId: null,
			category: "MESSAGES",
			sourceType: "MESSAGE",
			sourceId: "msg1",
		});
	});

	test("page message fans out to ADMIN/EDITOR only — MEMBERs and the sender excluded, page context tagged", async () => {
		resourcePerms.mockResolvedValue([
			{ userId: "admin", role: "ADMIN" },
			{ userId: "editor", role: "EDITOR" },
			{ userId: "member", role: "MEMBER" },
			{ userId: "alice", role: "ADMIN" }, // the sender is also a manager — must NOT be emailed
		] as never);

		const response = await POST(req({ recipientPageId: "pageY", content: "Hi there" }));
		expect(response.status).toBe(201);

		const entries = enqueuedEntries();
		expect(entries.map((e) => e.recipientUserId).sort()).toEqual(["admin", "editor"]);
		expect(entries.every((e) => e.contextPageId === "pageY")).toBe(true);
		expect(entries.every((e) => e.category === "MESSAGES" && e.sourceType === "MESSAGE" && e.sourceId === "msg1")).toBe(true);
	});

	test("an enqueue failure never fails the 201 (message still sent)", async () => {
		enqueue.mockRejectedValueOnce(new Error("outbox down"));
		const response = await POST(req({ recipientUserId: "bob", content: "Hi there" }));
		expect(response.status).toBe(201);
	});
});
