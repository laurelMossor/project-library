/**
 * Authorization for conversation-id messaging. Runs the REAL guarded writes (message-commands.ts), the
 * read-route prelude (message-routes.ts), and the server layer (message.ts) over mocked
 * Prisma/session/permissions, so an action or route that skips the identity or participation gate fails:
 *   - a non-participant gets not_found on every write and 404 on the thread read (no existence leak);
 *   - a page identity the caller can't act as (e.g. plain MEMBER) is refused before any data is read;
 *   - leaving as a page is ADMIN-only; DMs can't be left or edited;
 *   - group inputs are validated (blank name, bad member refs).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({
	canPostAsPage: vi.fn(),
	canManagePage: vi.fn(),
	getActingManagerIdsByPage: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/utils/server/email-outbox", () => ({ enqueueEmails: vi.fn() }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn(async () => false) }));
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

import { refresh } from "next/cache";
import { GET as getThread } from "@/app/api/messages/conversations/[conversationId]/route";
import {
	createGroupAction,
	editGroupAction,
	leaveGroupAction,
	resolveDirectConversationAction,
	sendMessageAction,
} from "@/lib/actions/message";
import { getSessionContext } from "@/lib/utils/server/session";
import { canPostAsPage, canManagePage } from "@/lib/utils/server/permission";
import { isRateLimited } from "@/lib/utils/server/rate-limit";
import { prisma } from "@/lib/utils/server/prisma";

const p = prisma as any;
const params = { params: Promise.resolve({ conversationId: "g1" }) };
const url = "http://test/api/messages/conversations/g1";
const participation = (kind: "GROUP" | "DIRECT") => ({ createdAt: new Date(0), lastReadAt: null, conversation: { id: "g1", kind, name: null } });

beforeEach(() => {
	vi.clearAllMocks();
	p.$transaction.mockImplementation(async (fn: any) => fn(p));
	vi.mocked(getSessionContext).mockResolvedValue({ userId: "sam", activePageId: null } as never);
	vi.mocked(canPostAsPage).mockResolvedValue(true);
	vi.mocked(isRateLimited).mockResolvedValue(false);
	p.conversationParticipant.findFirst.mockResolvedValue(participation("GROUP"));
	p.conversationParticipant.updateMany.mockResolvedValue({ count: 1 });
	p.conversationParticipant.findMany.mockResolvedValue([]);
	p.message.findMany.mockResolvedValue([]);
	p.message.create.mockResolvedValue({ id: "m1", conversationId: "g1", senderId: "sam", content: "hi", createdAt: new Date() });
	p.conversationParticipant.count.mockResolvedValue(1);
});

describe("signed out", () => {
	test("every write is unauthorized and touches nothing", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null);
		expect(await sendMessageAction({ conversationId: "g1", content: "hi" })).toMatchObject({ ok: false, error: "unauthorized" });
		expect(await leaveGroupAction({ conversationId: "g1" })).toMatchObject({ ok: false, error: "unauthorized" });
		expect(p.message.create).not.toHaveBeenCalled();
		expect(p.conversationParticipant.deleteMany).not.toHaveBeenCalled();
	});
});

describe("non-participant → not found everywhere", () => {
	beforeEach(() => {
		p.conversationParticipant.findFirst.mockResolvedValue(null);
		p.conversationParticipant.updateMany.mockResolvedValue({ count: 0 });
	});
	test("GET thread", async () => expect((await getThread(new Request(url), params)).status).toBe(404));
	test("send", async () => {
		expect(await sendMessageAction({ conversationId: "g1", content: "hi" })).toMatchObject({ ok: false, error: "not_found" });
		expect(p.message.create).not.toHaveBeenCalled();
	});
	test("rename/add", async () =>
		expect(await editGroupAction({ conversationId: "g1", name: "x" })).toMatchObject({ ok: false, error: "not_found" }));
	test("leave", async () =>
		expect(await leaveGroupAction({ conversationId: "g1" })).toMatchObject({ ok: false, error: "not_found" }));
});

describe("acting as a page the caller can't act as (plain MEMBER) → refused before any read", () => {
	beforeEach(() => vi.mocked(canPostAsPage).mockResolvedValue(false));
	test("GET thread", async () => {
		expect((await getThread(new Request(`${url}?asPageId=guild`), params)).status).toBe(400);
		expect(p.conversationParticipant.findFirst).not.toHaveBeenCalled();
	});
	test("send", async () => {
		expect(await sendMessageAction({ conversationId: "g1", content: "hi", asPageId: "guild" })).toMatchObject({ ok: false, error: "invalid" });
		expect(p.conversationParticipant.findFirst).not.toHaveBeenCalled();
	});
	test("leave", async () =>
		expect(await leaveGroupAction({ conversationId: "g1", asPageId: "guild" })).toMatchObject({ ok: false, error: "invalid" }));
	test("create group", async () =>
		expect(await createGroupAction({ asPageId: "guild", members: [{ type: "user", id: "pat" }] })).toMatchObject({ ok: false, error: "invalid" }));
});

describe("leave", () => {
	test("page EDITOR can't remove the page from a group (ADMIN-only)", async () => {
		vi.mocked(canManagePage).mockResolvedValue(false);
		expect(await leaveGroupAction({ conversationId: "g1", asPageId: "guild" })).toMatchObject({ ok: false, error: "forbidden" });
		expect(p.conversationParticipant.deleteMany).not.toHaveBeenCalled();
	});
	test("page ADMIN can", async () => {
		vi.mocked(canManagePage).mockResolvedValue(true);
		expect(await leaveGroupAction({ conversationId: "g1", asPageId: "guild" })).toEqual({
			ok: true,
			data: { deletedConversation: false },
		});
		expect(p.conversationParticipant.deleteMany.mock.calls[0][0].where).toEqual({ conversationId: "g1", pageId: "guild" });
	});
	test("a DM can't be left", async () => {
		p.conversationParticipant.findFirst.mockResolvedValue(participation("DIRECT"));
		expect(await leaveGroupAction({ conversationId: "g1" })).toMatchObject({ ok: false, error: "invalid" });
	});
});

describe("group edits", () => {
	test("a DM can't be renamed", async () => {
		p.conversationParticipant.findFirst.mockResolvedValue(participation("DIRECT"));
		expect(await editGroupAction({ conversationId: "g1", name: "x" })).toMatchObject({ ok: false, error: "invalid" });
	});
	test("nothing to update is refused", async () => {
		expect(await editGroupAction({ conversationId: "g1" })).toMatchObject({ ok: false, error: "invalid" });
	});
	test("a blank name clears the name (optional field) rather than erroring", async () => {
		expect(await editGroupAction({ conversationId: "g1", name: "   " })).toMatchObject({ ok: true });
		expect(p.conversation.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { name: null } });
	});
	test("an over-long name is rejected", async () => {
		expect(await editGroupAction({ conversationId: "g1", name: "x".repeat(200) })).toMatchObject({ ok: false, error: "invalid" });
		expect(p.conversation.update).not.toHaveBeenCalled();
	});
	test("an EDITOR acting as the page may rename (not a manage action)", async () => {
		vi.mocked(canManagePage).mockResolvedValue(false);
		expect(await editGroupAction({ conversationId: "g1", name: "Crew", asPageId: "guild" })).toMatchObject({ ok: true });
		expect(p.conversation.update).toHaveBeenCalledWith({ where: { id: "g1" }, data: { name: "Crew" } });
	});
	test("create with malformed members is refused", async () => {
		const result = await createGroupAction({ members: [{ type: "robot" as never, id: "x" }] });
		expect(result).toMatchObject({ ok: false, error: "invalid" });
	});
	test("resolving a DM with a bad target is refused before any lookup", async () => {
		expect(await resolveDirectConversationAction({ target: { type: "robot" as never, id: "x" } })).toMatchObject({
			ok: false,
			error: "invalid",
		});
		expect(await resolveDirectConversationAction({ target: { type: "user", id: "" } })).toMatchObject({
			ok: false,
			error: "invalid",
		});
		expect(p.$transaction).not.toHaveBeenCalled();
	});
	test("rate-limited group creation never writes", async () => {
		vi.mocked(isRateLimited).mockResolvedValue(true);
		expect(await createGroupAction({ members: [{ type: "user", id: "pat" }] })).toMatchObject({ ok: false, error: "rate_limited" });
		expect(p.conversation.create).not.toHaveBeenCalled();
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
		const result = await sendMessageAction({ conversationId: "g1", content: "hi", asPageId: "guild" });
		expect(result).toMatchObject({ ok: true, data: { id: "m1", conversationId: "g1", content: "hi" } });
		const createdAt = (await p.message.create.mock.results[0].value).createdAt;
		expect(p.conversationParticipant.updateMany.mock.calls[0][0].where).toEqual({
			conversationId: "g1",
			pageId: "guild",
			OR: [{ lastReadAt: null }, { lastReadAt: { lt: createdAt } }],
		});
		expect(p.message.create.mock.calls[0][0].data).toMatchObject({ senderId: "sam", asPageId: "guild" });
	});

	test("an empty message is refused before it's written", async () => {
		expect(await sendMessageAction({ conversationId: "g1", content: "   " })).toMatchObject({ ok: false, error: "invalid" });
		expect(p.message.create).not.toHaveBeenCalled();
	});

	test("messaging writes never refresh the server tree (its views are client-polled)", async () => {
		await sendMessageAction({ conversationId: "g1", content: "hi" });
		expect(refresh).not.toHaveBeenCalled();
	});
});
