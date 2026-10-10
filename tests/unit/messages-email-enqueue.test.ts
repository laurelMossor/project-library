/**
 * Unit tests for message email fan-out (`enqueueMessageEmails`) and its wiring into `sendMessageAction`.
 * Asserts the identity-scoping a generic reviewer can't see: every other participant is notified — users
 * personally, pages via their ADMIN/EDITOR managers tagged with the page context — while the sending
 * identity and the human who sent it never are; and an enqueue failure never fails the 201.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn(async () => false) }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({
	canPostAsPage: vi.fn(),
	canManagePage: vi.fn(),
	getActingManagerIdsByPage: vi.fn(),
}));
vi.mock("@/lib/utils/server/email-outbox", () => ({ enqueueEmails: vi.fn() }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => {
	const prisma: any = {
		user: { findUnique: vi.fn() },
		page: { findUnique: vi.fn() },
		conversationParticipant: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
		conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
		message: { create: vi.fn() },
		$executeRaw: vi.fn(),
	};
	prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
	return { prisma };
});

import { sendMessageAction } from "@/lib/actions/message";
import { enqueueMessageEmails } from "@/lib/utils/server/message";
import { getSessionContext } from "@/lib/utils/server/session";
import { canPostAsPage, getActingManagerIdsByPage } from "@/lib/utils/server/permission";
import { enqueueEmails } from "@/lib/utils/server/email-outbox";
import { prisma } from "@/lib/utils/server/prisma";

const p = prisma as any;
const enqueue = vi.mocked(enqueueEmails);
const recipients = () => ((enqueue.mock.calls.at(-1)?.[0] as any[]) ?? []).map((e) => `${e.recipientUserId}@${e.contextPageId ?? "personal"}`).sort();
const msg = { id: "m1", conversationId: "c1", senderId: "alice" };

beforeEach(() => {
	vi.clearAllMocks();
	p.$transaction.mockImplementation(async (fn: any) => fn(p));
	enqueue.mockResolvedValue(undefined as never);
	// The batched lookup returns ADMIN/EDITOR managers only (MEMBERs never appear) — see permission.ts.
	const managers: Record<string, string[]> = { guild: ["alice", "sam"], zine: ["zed"] };
	vi.mocked(getActingManagerIdsByPage).mockImplementation(async (pageIds: string[]) =>
		new Map(pageIds.filter((id) => managers[id]).map((id) => [id, managers[id]])));
});

describe("enqueueMessageEmails", () => {
	test("group: every other identity, pages fanned out to ADMIN/EDITOR managers, sender excluded", async () => {
		p.conversationParticipant.findMany.mockResolvedValue([
			{ userId: "alice", pageId: null },
			{ userId: "pat", pageId: null },
			{ userId: null, pageId: "guild" },
			{ userId: null, pageId: "zine" },
		]);
		await enqueueMessageEmails(msg, { type: "user", id: "alice" });
		// alice (sender) never — not personally, not as a guild manager.
		expect(recipients()).toEqual(["pat@personal", "sam@guild", "zed@zine"]);
		// One batched manager lookup for all recipient pages (no per-page N+1).
		expect(getActingManagerIdsByPage).toHaveBeenCalledTimes(1);
		expect(vi.mocked(getActingManagerIdsByPage).mock.calls[0][0].sort()).toEqual(["guild", "zine"]);
		const entries = enqueue.mock.calls[0][0] as any[];
		expect(entries.every((e) => e.category === "MESSAGES" && e.sourceType === "MESSAGE" && e.sourceId === "m1")).toBe(true);
	});

	test("sending AS a page: that page is skipped, and the human sender isn't emailed personally either", async () => {
		p.conversationParticipant.findMany.mockResolvedValue([
			{ userId: "alice", pageId: null },
			{ userId: "pat", pageId: null },
			{ userId: null, pageId: "guild" },
		]);
		await enqueueMessageEmails(msg, { type: "page", id: "guild" });
		expect(recipients()).toEqual(["pat@personal"]);
	});
});

describe("sendMessageAction into a DM", () => {
	const send = (input: { content: string; asPageId?: string }) => sendMessageAction({ conversationId: "c1", ...input });

	beforeEach(() => {
		vi.mocked(getSessionContext).mockResolvedValue({ userId: "alice", activePageId: null } as never);
		vi.mocked(canPostAsPage).mockResolvedValue(true);
		p.conversationParticipant.findFirst.mockResolvedValue({
			createdAt: new Date(0),
			lastReadAt: null,
			conversation: { id: "c1", kind: "DIRECT", name: null },
		});
		p.message.create.mockResolvedValue({ id: "m1", conversationId: "c1", senderId: "alice", asPageId: null, content: "Hi", createdAt: new Date() });
		p.conversationParticipant.findMany.mockResolvedValue([{ userId: "alice", pageId: null }, { userId: "bob", pageId: null }]);
	});

	test("sends into the DM, advances the sender's read marker, and emails the recipient", async () => {
		expect(await send({ content: "Hi" })).toMatchObject({ ok: true });
		const createdAt = (await p.message.create.mock.results[0].value).createdAt;
		expect(p.conversationParticipant.updateMany.mock.calls[0][0].where).toEqual({
			conversationId: "c1",
			userId: "alice",
			OR: [{ lastReadAt: null }, { lastReadAt: { lt: createdAt } }],
		});
		expect(recipients()).toEqual(["bob@personal"]);
	});

	test("to a page: fans out to its managers with the page context", async () => {
		p.conversationParticipant.findMany.mockResolvedValue([{ userId: "alice", pageId: null }, { userId: null, pageId: "guild" }]);
		await send({ content: "Hi" });
		expect(recipients()).toEqual(["sam@guild"]);
	});

	test("asPageId the caller can't act as → refused, nothing sent", async () => {
		vi.mocked(canPostAsPage).mockResolvedValue(false);
		expect(await send({ content: "Hi", asPageId: "guild" })).toMatchObject({ ok: false, error: "invalid" });
		expect(p.message.create).not.toHaveBeenCalled();
	});

	test("an enqueue failure never fails the send (message still sent)", async () => {
		enqueue.mockRejectedValueOnce(new Error("outbox down"));
		expect(await send({ content: "Hi" })).toMatchObject({ ok: true });
	});
});
