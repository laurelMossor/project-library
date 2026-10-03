/**
 * Unit tests for the messaging server layer (src/lib/utils/server/message.ts): identity scoping, the
 * per-identity "own message" rule, per-participant unread windows (read marker + join time), DM lookup
 * that can never match a group, page-message attribution (human sender only for that page's managers),
 * and the group lifecycle guards. Prisma and permissions are mocked; the queries' shapes are asserted
 * where the DB does the work.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => {
	const prisma: any = {
		conversationParticipant: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
		conversation: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
		message: { groupBy: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
		user: { findUnique: vi.fn(), count: vi.fn() },
		page: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
		$queryRaw: vi.fn(),
		$executeRaw: vi.fn(),
	};
	prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
	return { prisma };
});
vi.mock("@/lib/utils/server/permission", () => ({
	canPostAsPage: vi.fn(),
	canManagePage: vi.fn(),
	getActingManagerIdsByPage: vi.fn(),
}));
vi.mock("@/lib/utils/server/email-outbox", () => ({ enqueueEmails: vi.fn() }));

import {
	resolveMessagingIdentity,
	ownMessageWhere,
	isOwnMessage,
	getUnreadCountsByConversation,
	findDirectConversationId,
	findOrCreateDirectConversation,
	getThread,
	listInbox,
	markConversationRead,
	loadReadMarkers,
	readMarkerKey,
	isMessageReadBy,
	createGroup,
	addGroupMembers,
	leaveGroup,
} from "@/lib/utils/server/message";
import { prisma } from "@/lib/utils/server/prisma";
import { canPostAsPage, canManagePage } from "@/lib/utils/server/permission";
import { MAX_GROUP_PARTICIPANTS } from "@/lib/const/messaging";

const p = prisma as any;
const alice = { type: "user", id: "alice" } as const;
const sam = { type: "user", id: "sam" } as const;
const guild = { type: "page", id: "guild" } as const;
const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min));

beforeEach(() => {
	vi.clearAllMocks();
	p.$transaction.mockImplementation(async (fn: any) => fn(p));
});

describe("resolveMessagingIdentity", () => {
	test("no asPageId → the user personally", async () => {
		expect(await resolveMessagingIdentity("alice", null)).toEqual(alice);
		expect(canPostAsPage).not.toHaveBeenCalled();
	});
	test("a page the user may act as (ADMIN/EDITOR) → the page", async () => {
		vi.mocked(canPostAsPage).mockResolvedValue(true);
		expect(await resolveMessagingIdentity("alice", "guild")).toEqual(guild);
	});
	test("a page the user may NOT act as (e.g. plain MEMBER) → null", async () => {
		vi.mocked(canPostAsPage).mockResolvedValue(false);
		expect(await resolveMessagingIdentity("alice", "guild")).toBeNull();
	});
});

describe("own-message rule is per identity", () => {
	test("a user owns only what they sent personally", () => {
		expect(ownMessageWhere(alice)).toEqual({ senderId: "alice", asPageId: null });
		expect(isOwnMessage({ senderId: "alice", asPageId: null }, alice)).toBe(true);
		// alice sending AS the guild is not alice-personal's message…
		expect(isOwnMessage({ senderId: "alice", asPageId: "guild" }, alice)).toBe(false);
	});
	test("a page owns everything sent as it, by any manager", () => {
		expect(ownMessageWhere(guild)).toEqual({ asPageId: "guild" });
		expect(isOwnMessage({ senderId: "sam", asPageId: "guild" }, guild)).toBe(true);
		// …and alice's personal message is unread for the guild she manages.
		expect(isOwnMessage({ senderId: "alice", asPageId: null }, guild)).toBe(false);
	});
});

describe("getUnreadCountsByConversation", () => {
	test("each conversation's window starts after the read marker, or at join time when unread", async () => {
		p.message.groupBy.mockResolvedValue([{ conversationId: "c1", _count: { _all: 2 } }]);
		const counts = await getUnreadCountsByConversation(alice, [
			{ conversationId: "c1", createdAt: t(0), lastReadAt: t(5) },
			{ conversationId: "c2", createdAt: t(10), lastReadAt: null },
		]);
		expect(counts.get("c1")).toBe(2);
		expect(counts.has("c2")).toBe(false);
		const where = p.message.groupBy.mock.calls[0][0].where;
		expect(where.OR).toEqual([
			{ conversationId: "c1", createdAt: { gt: t(5) } },
			{ conversationId: "c2", createdAt: { gte: t(10) } }, // late joiner: nothing before join counts
		]);
		expect(where.NOT).toEqual({ senderId: "alice", asPageId: null });
	});
	test("no conversations → no query", async () => {
		expect((await getUnreadCountsByConversation(alice, [])).size).toBe(0);
		expect(p.message.groupBy).not.toHaveBeenCalled();
	});
});

describe("direct messages", () => {
	test("DM lookup is constrained to DIRECT — a group both are in can never match", async () => {
		p.conversation.findFirst.mockResolvedValue(null);
		await findDirectConversationId(alice, sam);
		expect(p.conversation.findFirst.mock.calls[0][0].where).toEqual({
			kind: "DIRECT",
			AND: [{ participants: { some: { userId: "alice" } } }, { participants: { some: { userId: "sam" } } }],
		});
	});
	test("messaging yourself is rejected", async () => {
		expect(await findOrCreateDirectConversation(alice, alice)).toMatchObject({ ok: false, status: 400 });
	});
	test("unknown recipient → 404", async () => {
		p.user.findUnique.mockResolvedValue(null);
		expect(await findOrCreateDirectConversation(alice, sam)).toMatchObject({ ok: false, status: 404 });
	});
	test("find-or-create is serialized per pair by an advisory lock, inside the transaction", async () => {
		p.user.findUnique.mockResolvedValue({ id: "sam" });
		p.conversation.findFirst.mockResolvedValue({ id: "dm1" });
		await findOrCreateDirectConversation(alice, sam);
		expect(p.$transaction).toHaveBeenCalled();
		const sql = p.$executeRaw.mock.calls[0][0].join("?");
		expect(sql).toContain("pg_advisory_xact_lock");
		// Same key regardless of who initiates — the pair key is sorted.
		expect(p.$executeRaw.mock.calls[0][1]).toBe("user:alice|user:sam");
		p.$executeRaw.mockClear();
		await findOrCreateDirectConversation(sam, alice);
		expect(p.$executeRaw.mock.calls[0][1]).toBe("user:alice|user:sam");
	});

	test("no existing DM → creates a DIRECT conversation with both identities", async () => {
		p.user.findUnique.mockResolvedValue({ id: "sam" });
		p.conversation.findFirst.mockResolvedValue(null);
		p.conversation.create.mockResolvedValue({ id: "dm1" });
		expect(await findOrCreateDirectConversation(guild, sam)).toEqual({ ok: true, value: { id: "dm1", created: true } });
		expect(p.conversation.create.mock.calls[0][0].data).toEqual({
			kind: "DIRECT",
			participants: { create: [{ pageId: "guild" }, { userId: "sam" }] },
		});
	});
});

describe("getThread", () => {
	const senderAlice = { id: "alice", handle: "alice" };
	beforeEach(() => {
		p.conversationParticipant.findFirst.mockResolvedValue({
			createdAt: t(3), lastReadAt: null, conversation: { id: "g1", kind: "GROUP", name: "Crew" },
		});
		p.conversationParticipant.findMany.mockResolvedValue([
			{ userId: "sam", pageId: null, user: { id: "sam" }, page: null },
			{ userId: null, pageId: "guild", user: null, page: { id: "guild", name: "Guild" } },
		]);
		p.message.findMany.mockResolvedValue([
			{ id: "m1", content: "as guild", createdAt: t(4), senderId: "alice", asPageId: "guild", sender: senderAlice },
		]);
	});

	test("non-participant → null (route 404s)", async () => {
		p.conversationParticipant.findFirst.mockResolvedValue(null);
		expect(await getThread("g1", sam, "sam")).toBeNull();
	});

	test("only messages since the viewer joined are loaded", async () => {
		await getThread("g1", sam, "sam");
		expect(p.message.findMany.mock.calls[0][0].where).toEqual({ conversationId: "g1", createdAt: { gte: t(3) } });
	});

	test("page message: other members see the page only — no human sender in the payload", async () => {
		const thread = await getThread("g1", sam, "sam");
		const m = thread!.messages[0];
		expect(m.author).toEqual({ type: "page", page: { id: "guild", name: "Guild" } });
		expect(m.sentBy).toBeNull();
		expect(JSON.stringify(thread)).not.toContain('"handle":"alice"');
	});

	test("page message: that page's own managers also see who sent it", async () => {
		vi.mocked(canManagePage).mockResolvedValue(false);
		const thread = await getThread("g1", guild, "sam");
		expect(thread!.messages[0].sentBy).toEqual(senderAlice);
		expect(thread!.messages[0].isOwn).toBe(true);
	});

	test("canLeave: a user always; a page only for its ADMIN", async () => {
		expect((await getThread("g1", sam, "sam"))!.canLeave).toBe(true);
		vi.mocked(canManagePage).mockResolvedValue(false);
		expect((await getThread("g1", guild, "sam"))!.canLeave).toBe(false);
		vi.mocked(canManagePage).mockResolvedValue(true);
		expect((await getThread("g1", guild, "alice"))!.canLeave).toBe(true);
	});

	// Viewing marks read, inline with the fetch — no second request, and (by construction) no race with
	// a message arriving between "load" and "mark read": they're the same request.
	test("fetching the thread marks it read up to its newest message, in the same request", async () => {
		p.message.findFirst.mockResolvedValue({ createdAt: t(4) }); // "m1"'s own createdAt
		await getThread("g1", sam, "sam");
		expect(p.message.findFirst.mock.calls[0][0].where).toEqual({ id: "m1", conversationId: "g1" });
		expect(p.conversationParticipant.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { lastReadAt: t(4) } }),
		);
	});

	test("already read as of a later time → the marker never moves backwards", async () => {
		p.conversationParticipant.findFirst.mockResolvedValue({
			createdAt: t(3), lastReadAt: t(5), conversation: { id: "g1", kind: "GROUP", name: "Crew" },
		});
		p.message.findFirst.mockResolvedValue({ createdAt: t(4) });
		await getThread("g1", sam, "sam");
		expect(p.conversationParticipant.update).not.toHaveBeenCalled();
	});

	test("an empty thread has nothing to mark read", async () => {
		p.message.findMany.mockResolvedValue([]);
		await getThread("g1", sam, "sam");
		expect(p.message.findFirst).not.toHaveBeenCalled();
		expect(p.conversationParticipant.update).not.toHaveBeenCalled();
	});
});

describe("group lifecycle", () => {
	beforeEach(() => {
		p.user.count.mockImplementation(async ({ where }: any) => where.id.in.length);
		p.page.count.mockImplementation(async ({ where }: any) => where.id.in.length);
	});

	test("create: the creator can't also be listed as a member", async () => {
		expect(await createGroup(alice, [alice, sam], null)).toMatchObject({ ok: false, status: 400 });
	});

	test("create: dedupes members and includes the creator", async () => {
		p.conversation.create.mockResolvedValue({ id: "g1" });
		expect(await createGroup(guild, [sam, sam, alice], "  Crew  ")).toEqual({ ok: true, value: { id: "g1" } });
		expect(p.conversation.create.mock.calls[0][0].data).toEqual({
			kind: "GROUP",
			name: "Crew",
			participants: { create: [{ pageId: "guild" }, { userId: "sam" }, { userId: "alice" }] },
		});
	});

	test("create: over the participant cap is rejected (creator counts)", async () => {
		const members = Array.from({ length: MAX_GROUP_PARTICIPANTS }, (_, i) => ({ type: "user" as const, id: `u${i}` }));
		expect(await createGroup(alice, members, null)).toMatchObject({ ok: false, status: 400 });
		expect(p.conversation.create).not.toHaveBeenCalled();
	});

	test("create: a member that doesn't exist → 404", async () => {
		p.user.count.mockResolvedValue(0);
		expect(await createGroup(alice, [sam], null)).toMatchObject({ ok: false, status: 404 });
	});

	test("add: locks the conversation row, skips existing members, and enforces the cap", async () => {
		p.conversationParticipant.findMany.mockResolvedValue([{ userId: "alice", pageId: null }, { userId: "sam", pageId: null }]);
		const res = await addGroupMembers("g1", [sam, guild]);
		expect(res).toEqual({ ok: true, value: { added: 1 } });
		expect(p.$queryRaw).toHaveBeenCalled(); // SELECT … FOR UPDATE — serializes concurrent adds
		expect(p.conversationParticipant.createMany.mock.calls[0][0].data).toEqual([{ conversationId: "g1", pageId: "guild" }]);
	});

	test("add: re-adding only existing members is a no-op", async () => {
		p.conversationParticipant.findMany.mockResolvedValue([{ userId: "sam", pageId: null }]);
		expect(await addGroupMembers("g1", [sam])).toEqual({ ok: true, value: { added: 0 } });
		expect(p.conversationParticipant.createMany).not.toHaveBeenCalled();
	});

	test("add: would exceed the cap → 400, nothing written", async () => {
		p.conversationParticipant.findMany.mockResolvedValue(
			Array.from({ length: MAX_GROUP_PARTICIPANTS }, (_, i) => ({ userId: `u${i}`, pageId: null })),
		);
		expect(await addGroupMembers("g1", [guild])).toMatchObject({ ok: false, status: 400 });
		expect(p.conversationParticipant.createMany).not.toHaveBeenCalled();
	});

	test("leave: removes only the acting identity; the last one out deletes the conversation", async () => {
		p.conversationParticipant.count.mockResolvedValue(1);
		expect(await leaveGroup("g1", guild)).toEqual({ deletedConversation: false });
		expect(p.conversationParticipant.deleteMany.mock.calls[0][0].where).toEqual({ conversationId: "g1", pageId: "guild" });
		expect(p.conversation.delete).not.toHaveBeenCalled();

		p.conversationParticipant.count.mockResolvedValue(0);
		expect(await leaveGroup("g1", sam)).toEqual({ deletedConversation: true });
		expect(p.conversation.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
	});
});

describe("markConversationRead", () => {
	beforeEach(() => {
		p.conversationParticipant.findFirst.mockResolvedValue({ id: "part1", lastReadAt: t(5) });
	});

	test("non-participant → false, nothing written", async () => {
		p.conversationParticipant.findFirst.mockResolvedValue(null);
		expect(await markConversationRead("c1", alice, "m9")).toBe(false);
		expect(p.conversationParticipant.update).not.toHaveBeenCalled();
	});

	test("reads up to the loaded message's time — not 'now' (a later arrival stays unread)", async () => {
		p.message.findFirst.mockResolvedValue({ createdAt: t(8) });
		expect(await markConversationRead("c1", alice, "m8")).toBe(true);
		expect(p.message.findFirst.mock.calls[0][0].where).toEqual({ id: "m8", conversationId: "c1" });
		expect(p.conversationParticipant.update).toHaveBeenCalledWith({ where: { id: "part1" }, data: { lastReadAt: t(8) } });
	});

	test("never moves the marker backwards", async () => {
		p.message.findFirst.mockResolvedValue({ createdAt: t(2) });
		await markConversationRead("c1", alice, "m2");
		expect(p.conversationParticipant.update).not.toHaveBeenCalled();
	});

	test("a message from another conversation is ignored", async () => {
		p.message.findFirst.mockResolvedValue(null); // scoped lookup misses it
		expect(await markConversationRead("c1", alice, "other")).toBe(true);
		expect(p.conversationParticipant.update).not.toHaveBeenCalled();
	});

	test("no message id (empty thread) is a no-op for a participant", async () => {
		expect(await markConversationRead("c1", alice)).toBe(true);
		expect(p.message.findFirst).not.toHaveBeenCalled();
	});
});

describe("read markers (email-flush read-suppression)", () => {
	test("keyed per conversation + identity; a page participant is keyed as the page", async () => {
		p.conversationParticipant.findMany.mockResolvedValue([
			{ conversationId: "c1", userId: "alice", pageId: null, lastReadAt: t(4) },
			{ conversationId: "c1", userId: null, pageId: "guild", lastReadAt: null },
		]);
		const markers = await loadReadMarkers(["c1", "c1"]);
		expect(markers.get(readMarkerKey("c1", alice))).toEqual(t(4));
		expect(markers.get(readMarkerKey("c1", guild))).toBeNull();
		expect(markers.has(readMarkerKey("c1", sam))).toBe(false); // not a participant
	});
	test("isMessageReadBy matches the unread window (read = marker at/after the message)", () => {
		expect(isMessageReadBy(t(5), { createdAt: t(5) })).toBe(true);
		expect(isMessageReadBy(t(4), { createdAt: t(5) })).toBe(false);
		expect(isMessageReadBy(null, { createdAt: t(5) })).toBe(false);
	});
});

describe("listInbox", () => {
	const participantRows = [
		{ conversationId: "g1", createdAt: t(10), lastReadAt: null }, // joined the group late
		{ conversationId: "dm1", createdAt: t(0), lastReadAt: t(1) },
	];
	beforeEach(() => {
		p.conversationParticipant.findMany.mockResolvedValue(participantRows);
		p.message.groupBy.mockResolvedValue([{ conversationId: "dm1", _count: { _all: 3 } }]);
		p.conversation.findMany.mockResolvedValue([
			{
				id: "g1", kind: "GROUP", name: "Crew", updatedAt: t(12),
				participants: [{ userId: "alice", pageId: null, user: { id: "alice" }, page: null }],
				// The group's latest message predates alice joining → must not preview.
				messages: [{ id: "old", content: "before you joined", createdAt: t(9), senderId: "sam", asPageId: null, sender: { id: "sam" } }],
			},
			{
				id: "dm1", kind: "DIRECT", name: null, updatedAt: t(11),
				participants: [{ userId: "alice", pageId: null, user: { id: "alice" }, page: null }, { userId: "sam", pageId: null, user: { id: "sam" }, page: null }],
				messages: [{ id: "m3", content: "hi", createdAt: t(11), senderId: "sam", asPageId: null, sender: { id: "sam" } }],
			},
		]);
	});

	test("groups show from creation (no messages needed); DMs only once they have a message", async () => {
		await listInbox(alice);
		expect(p.conversation.findMany.mock.calls[0][0].where).toEqual({
			id: { in: ["g1", "dm1"] },
			OR: [{ kind: "GROUP" }, { messages: { some: {} } }],
		});
	});

	test("a late joiner's preview hides the pre-join message; unread counts are per row", async () => {
		const [group, dm] = await listInbox(alice);
		expect(group.lastMessage).toBeNull();
		expect(group.unreadCount).toBe(0);
		expect(dm.lastMessage).toMatchObject({ id: "m3", isOwn: false });
		expect(dm.unreadCount).toBe(3);
		expect(dm.members.find((m) => m.isYou)?.id).toBe("alice");
	});

	test("no conversations → no further queries", async () => {
		p.conversationParticipant.findMany.mockResolvedValue([]);
		expect(await listInbox(alice)).toEqual([]);
		expect(p.conversation.findMany).not.toHaveBeenCalled();
	});
});
