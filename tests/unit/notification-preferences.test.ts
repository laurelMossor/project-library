/**
 * Unit tests for the email preference resolver (notification-preferences.ts). Mocks ONLY prisma and
 * runs the real resolution over the (user, context) model: category defaults, the per-context master
 * (category NULL), per-profile AND per-manager independence, and the batching guarantee. Also covers
 * writePref's find-then-write (never `upsert`, because of the partial indexes).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		notificationPreference: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
		$transaction: vi.fn(async (fn: any) => fn(prismaMock)),
	},
}));

import { resolveEmailPrefs, getEffectivePrefs, setPref, setMaster, prefDecisionKey } from "@/lib/utils/server/notification-preferences";
import { prisma } from "@/lib/utils/server/prisma";

const prismaMock = prisma as any;
const prefFindMany = vi.mocked(prisma.notificationPreference.findMany);

/** A stored preference row. category null = the per-context master. */
function row(userId: string, contextPageId: string | null, category: string | null, enabled: boolean) {
	return { userId, contextPageId, category, enabled };
}

beforeEach(() => {
	vi.clearAllMocks();
	prefFindMany.mockResolvedValue([] as never);
});

describe("resolveEmailPrefs — defaults + master", () => {
	test("no rows → category defaults, master defaults on", async () => {
		const items = [
			{ recipientUserId: "alice", contextPageId: null, category: "COMMENTS" as const },
			{ recipientUserId: "alice", contextPageId: null, category: "FOLLOWS" as const },
		];
		const d = await resolveEmailPrefs(items);
		expect(d.get(prefDecisionKey(items[0], "COMMENTS"))).toBe(true); // default on
		expect(d.get(prefDecisionKey(items[1], "FOLLOWS"))).toBe(false); // default off
	});

	test("stored category rows override defaults both directions", async () => {
		prefFindMany.mockResolvedValue([
			row("alice", null, "COMMENTS", false),
			row("alice", null, "FOLLOWS", true),
		] as never);
		const items = [
			{ recipientUserId: "alice", contextPageId: null, category: "COMMENTS" as const },
			{ recipientUserId: "alice", contextPageId: null, category: "FOLLOWS" as const },
		];
		const d = await resolveEmailPrefs(items);
		expect(d.get(prefDecisionKey(items[0], "COMMENTS"))).toBe(false);
		expect(d.get(prefDecisionKey(items[1], "FOLLOWS"))).toBe(true);
	});

	test("per-context master (category NULL) off suppresses every category in that context only", async () => {
		prefFindMany.mockResolvedValue([row("alice", null, null, false)] as never); // personal master off
		const personal = { recipientUserId: "alice", contextPageId: null, category: "COMMENTS" as const };
		const pageCtx = { recipientUserId: "alice", contextPageId: "pageX", category: "COMMENTS" as const };
		const d = await resolveEmailPrefs([personal, pageCtx]);
		expect(d.get(prefDecisionKey(personal, "COMMENTS"))).toBe(false); // personal master off
		expect(d.get(prefDecisionKey(pageCtx, "COMMENTS"))).toBe(true); // page context unaffected
	});
});

describe("resolveEmailPrefs — per-profile and per-manager independence", () => {
	test("same user: personal COMMENTS on, page-context COMMENTS off", async () => {
		prefFindMany.mockResolvedValue([row("alice", "pageX", "COMMENTS", false)] as never);
		const personal = { recipientUserId: "alice", contextPageId: null, category: "COMMENTS" as const };
		const pageCtx = { recipientUserId: "alice", contextPageId: "pageX", category: "COMMENTS" as const };
		const d = await resolveEmailPrefs([personal, pageCtx]);
		expect(d.get(prefDecisionKey(personal, "COMMENTS"))).toBe(true);
		expect(d.get(prefDecisionKey(pageCtx, "COMMENTS"))).toBe(false);
	});

	test("two managers of the SAME page have independent page prefs", async () => {
		// adminA turned the page's COMMENTS email off; adminB left it (default on).
		prefFindMany.mockResolvedValue([row("adminA", "pageX", "COMMENTS", false)] as never);
		const a = { recipientUserId: "adminA", contextPageId: "pageX", category: "COMMENTS" as const };
		const b = { recipientUserId: "adminB", contextPageId: "pageX", category: "COMMENTS" as const };
		const d = await resolveEmailPrefs([a, b]);
		expect(d.get(prefDecisionKey(a, "COMMENTS"))).toBe(false);
		expect(d.get(prefDecisionKey(b, "COMMENTS"))).toBe(true);
	});
});

describe("resolveEmailPrefs — batching", () => {
	test("N identities cost ONE query; empty input issues none", async () => {
		await resolveEmailPrefs([
			{ recipientUserId: "a", contextPageId: null, category: "COMMENTS" },
			{ recipientUserId: "b", contextPageId: "p1", category: "MESSAGES" },
		]);
		expect(prefFindMany).toHaveBeenCalledTimes(1);
		vi.clearAllMocks();
		const d = await resolveEmailPrefs([]);
		expect(d.size).toBe(0);
		expect(prefFindMany).not.toHaveBeenCalled();
	});
});

describe("getEffectivePrefs", () => {
	test("master + every category from rows or defaults", async () => {
		prefFindMany.mockResolvedValue([
			row("alice", null, null, false), // master off
			row("alice", null, "RSVPS", true), // opt into RSVPs
		] as never);
		const res = await getEffectivePrefs({ recipientUserId: "alice", contextPageId: null });
		expect(res.master).toBe(false);
		expect(res.categories.COMMENTS).toBe(true); // default on
		expect(res.categories.RSVPS).toBe(true); // stored
		expect(res.categories.FOLLOWS).toBe(false); // default off
	});
});

describe("writePref — find-then-write (no upsert)", () => {
	test("setPref creates a category row when none exists", async () => {
		vi.mocked(prisma.notificationPreference.findFirst).mockResolvedValue(null as never);
		await setPref({ recipientUserId: "alice", contextPageId: "pageX" }, "COMMENTS" as never, false);
		expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
			data: { userId: "alice", contextPageId: "pageX", category: "COMMENTS", enabled: false },
		});
	});

	test("setMaster updates the existing master row (category null)", async () => {
		vi.mocked(prisma.notificationPreference.findFirst).mockResolvedValue({ id: "m1" } as never);
		await setMaster({ recipientUserId: "alice", contextPageId: null }, false);
		expect(prisma.notificationPreference.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: "alice", contextPageId: null, category: null } }),
		);
		expect(prisma.notificationPreference.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { enabled: false } });
	});

	test("recovers from a concurrent-insert P2002 by retrying as an update", async () => {
		// First pass: no row → create races a concurrent insert and hits the partial unique index (P2002).
		// Retry pass: the row now exists → find + update.
		vi.mocked(prisma.notificationPreference.findFirst)
			.mockResolvedValueOnce(null as never)
			.mockResolvedValueOnce({ id: "raced1" } as never);
		vi.mocked(prisma.notificationPreference.create).mockRejectedValueOnce(
			new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }),
		);

		await setPref({ recipientUserId: "alice", contextPageId: "pageX" }, "COMMENTS" as never, false);

		expect(prisma.notificationPreference.create).toHaveBeenCalledTimes(1);
		expect(prisma.notificationPreference.update).toHaveBeenCalledWith({ where: { id: "raced1" }, data: { enabled: false } });
	});
});
