/**
 * Route-level authorization for the conversation-id messaging routes. Runs the REAL route prelude
 * (message-routes.ts) and server layer (message.ts) over mocked Prisma/session/permissions, so a route
 * that skips the identity or participation gate fails here:
 *   - a non-participant gets 404 on every method (never 403 — no existence leak);
 *   - a page identity the caller can't act as (e.g. plain MEMBER) is rejected before any data is read;
 *   - leaving as a page is ADMIN-only; DMs can't be left or edited;
 *   - group inputs are validated (blank name, bad member refs).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({
	canPostAsPage: vi.fn(),
	canManagePage: vi.fn(),
	getActingManagerIdsByPage: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/utils/server/email-outbox", () => ({ enqueueEmails: vi.fn() }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/utils/server/prisma", () => {
	const prisma: any = {
		conversationParticipant: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), createMany: vi.fn() },
		conversation: { update: vi.fn(), delete: vi.fn(), create: vi.fn() },
		message: { findMany: vi.fn(), create: vi.fn() },
		page: { findMany: vi.fn(async () => []) },
		user: { count: vi.fn() },
		$queryRaw: vi.fn(),
	};
	prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
	return { prisma };
});

import { GET as getThread, PATCH as editGroup } from "@/app/api/messages/conversations/[conversationId]/route";
import { POST as send } from "@/app/api/messages/conversations/[conversationId]/messages/route";
import { POST as leave } from "@/app/api/messages/conversations/[conversationId]/leave/route";
import { POST as createGroup } from "@/app/api/messages/conversations/route";
import { getSessionContext } from "@/lib/utils/server/session";
import { canPostAsPage, canManagePage } from "@/lib/utils/server/permission";
import { prisma } from "@/lib/utils/server/prisma";

const p = prisma as any;
const params = { params: Promise.resolve({ conversationId: "g1" }) };
const url = "http://test/api/messages/conversations/g1";
const body = (b: unknown, method = "POST") => new Request(url, { method, body: JSON.stringify(b) });
const participation = (kind: "GROUP" | "DIRECT") => ({ createdAt: new Date(0), lastReadAt: null, conversation: { id: "g1", kind, name: null } });

beforeEach(() => {
	vi.clearAllMocks();
	p.$transaction.mockImplementation(async (fn: any) => fn(p));
	vi.mocked(getSessionContext).mockResolvedValue({ userId: "sam", activePageId: null } as never);
	vi.mocked(canPostAsPage).mockResolvedValue(true);
	p.conversationParticipant.findFirst.mockResolvedValue(participation("GROUP"));
	p.conversationParticipant.updateMany.mockResolvedValue({ count: 1 });
	p.conversationParticipant.findMany.mockResolvedValue([]);
	p.message.findMany.mockResolvedValue([]);
	p.message.create.mockResolvedValue({ id: "m1", conversationId: "g1", senderId: "sam", content: "hi", createdAt: new Date() });
	p.conversationParticipant.count.mockResolvedValue(1);
});

describe("non-participant → 404 on every method", () => {
	beforeEach(() => {
		p.conversationParticipant.findFirst.mockResolvedValue(null);
		p.conversationParticipant.updateMany.mockResolvedValue({ count: 0 });
	});
	test("GET thread", async () => expect((await getThread(new Request(url), params)).status).toBe(404));
	test("POST message", async () => {
		expect((await send(body({ content: "hi" }), params)).status).toBe(404);
		expect(p.message.create).not.toHaveBeenCalled();
	});
	test("PATCH rename/add", async () => expect((await editGroup(body({ name: "x" }, "PATCH"), params)).status).toBe(404));
	test("POST leave", async () => expect((await leave(body({}), params)).status).toBe(404));
});

describe("acting as a page the caller can't act as (plain MEMBER) → 400 before any read", () => {
	beforeEach(() => vi.mocked(canPostAsPage).mockResolvedValue(false));
	test("GET thread", async () => {
		expect((await getThread(new Request(`${url}?asPageId=guild`), params)).status).toBe(400);
		expect(p.conversationParticipant.findFirst).not.toHaveBeenCalled();
	});
	test("POST message", async () => expect((await send(body({ content: "hi", asPageId: "guild" }), params)).status).toBe(400));
	test("POST leave", async () => expect((await leave(body({ asPageId: "guild" }), params)).status).toBe(400));
	test("POST create group", async () => {
		const res = await createGroup(new Request("http://test", { method: "POST", body: JSON.stringify({ asPageId: "guild", members: [{ type: "user", id: "pat" }] }) }));
		expect(res.status).toBe(400);
	});
});

describe("leave", () => {
	test("page EDITOR can't remove the page from a group (ADMIN-only)", async () => {
		vi.mocked(canManagePage).mockResolvedValue(false);
		const res = await leave(body({ asPageId: "guild" }), params);
		expect(res.status).toBe(403);
		expect(p.conversationParticipant.deleteMany).not.toHaveBeenCalled();
	});
	test("page ADMIN can", async () => {
		vi.mocked(canManagePage).mockResolvedValue(true);
		const res = await leave(body({ asPageId: "guild" }), params);
		expect(res.status).toBe(200);
		expect(p.conversationParticipant.deleteMany.mock.calls[0][0].where).toEqual({ conversationId: "g1", pageId: "guild" });
	});
	test("a DM can't be left", async () => {
		p.conversationParticipant.findFirst.mockResolvedValue(participation("DIRECT"));
		expect((await leave(body({}), params)).status).toBe(400);
	});
});

describe("group edits", () => {
	test("a DM can't be renamed", async () => {
		p.conversationParticipant.findFirst.mockResolvedValue(participation("DIRECT"));
		expect((await editGroup(body({ name: "x" }, "PATCH"), params)).status).toBe(400);
	});
	test("a blank name clears the name (optional field) rather than erroring", async () => {
		expect((await editGroup(body({ name: "   " }, "PATCH"), params)).status).toBe(200);
		expect(p.conversation.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { name: null } });
	});
	test("an over-long name is rejected", async () => {
		expect((await editGroup(body({ name: "x".repeat(200) }, "PATCH"), params)).status).toBe(400);
		expect(p.conversation.update).not.toHaveBeenCalled();
	});
	test("an EDITOR acting as the page may rename (not a manage action)", async () => {
		vi.mocked(canManagePage).mockResolvedValue(false);
		expect((await editGroup(body({ name: "Crew", asPageId: "guild" }, "PATCH"), params)).status).toBe(200);
		expect(p.conversation.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { name: "Crew" } });
	});
	test("create with malformed members → 400", async () => {
		const res = await createGroup(new Request("http://test", { method: "POST", body: JSON.stringify({ members: [{ type: "robot", id: "x" }] }) }));
		expect(res.status).toBe(400);
	});
});

describe("GET thread marks read for the acting identity", () => {
	const seenAt = new Date("2026-01-01T00:04:00.000Z");
	const forwardOnly = (upTo: Date) => [{ lastReadAt: null }, { lastReadAt: { lt: upTo } }];

	test("one message → the marker advances to that message's createdAt", async () => {
		p.message.findMany.mockResolvedValue([
			{ id: "m1", content: "hi", createdAt: seenAt, senderId: "alice", asPageId: null, sender: { id: "alice" } },
		]);
		const res = await getThread(new Request(url), params);
		expect(res.status).toBe(200);
		expect(p.conversationParticipant.updateMany).toHaveBeenCalledWith({
			where: { conversationId: "g1", userId: "sam", OR: forwardOnly(seenAt) },
			data: { lastReadAt: seenAt },
		});
	});

	test("an empty thread has nothing to mark", async () => {
		const res = await getThread(new Request(url), params);
		expect(res.status).toBe(200);
		expect(p.conversationParticipant.updateMany).not.toHaveBeenCalled();
	});
});

describe("participant send", () => {
	test("advances only the sending identity's read marker", async () => {
		const res = await send(body({ content: "hi", asPageId: "guild" }), params);
		expect(res.status).toBe(201);
		const createdAt = (await p.message.create.mock.results[0].value).createdAt;
		expect(p.conversationParticipant.updateMany.mock.calls[0][0].where).toEqual({
			conversationId: "g1",
			pageId: "guild",
			OR: [{ lastReadAt: null }, { lastReadAt: { lt: createdAt } }],
		});
		expect(p.message.create.mock.calls[0][0].data).toMatchObject({ senderId: "sam", asPageId: "guild" });
	});
});
