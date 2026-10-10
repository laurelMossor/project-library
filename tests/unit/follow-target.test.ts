/**
 * followTarget / unfollowTarget. Prisma is mocked; requestOrCreateFollow runs for real,
 * so a forgotten visibility read (a PRIVATE profile followed outright) fails here.
 * The session stub is the same load-time guard as requests.test.ts.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ProfileVisibility } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		follow: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
		user: { findUnique: vi.fn() },
		page: { findUnique: vi.fn() },
		accessRequest: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { followTarget, unfollowTarget } from "@/lib/utils/server/follow";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
	vi.mocked(prisma.page.findUnique).mockResolvedValue(null);
	vi.mocked(prisma.follow.findUnique).mockResolvedValue(null);
	vi.mocked(prisma.follow.findFirst).mockResolvedValue(null);
	vi.mocked(prisma.accessRequest.findFirst).mockResolvedValue(null);
	vi.mocked(prisma.accessRequest.deleteMany).mockResolvedValue({ count: 0 } as never);
});

describe("followTarget", () => {
	test("refuses following yourself before any lookup", async () => {
		const res = await followTarget("u1", { type: "USER", id: "u1" });
		expect(res).toEqual({ ok: false, reason: "self" });
		expect(prisma.user.findUnique).not.toHaveBeenCalled();
		expect(prisma.follow.create).not.toHaveBeenCalled();
	});

	test("missing user → not_found, no edge", async () => {
		const res = await followTarget("u1", { type: "USER", id: "u2" });
		expect(res).toEqual({ ok: false, reason: "not_found" });
		expect(prisma.follow.create).not.toHaveBeenCalled();
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});

	test("missing page → not_found, no edge", async () => {
		const res = await followTarget("u1", { type: "PAGE", id: "p2" });
		expect(res).toEqual({ ok: false, reason: "not_found" });
		expect(prisma.follow.create).not.toHaveBeenCalled();
	});

	test("already following → no second edge", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({
			id: "u2",
			profileVisibility: ProfileVisibility.PUBLIC,
		} as never);
		vi.mocked(prisma.follow.findUnique).mockResolvedValue({ id: "f1" } as never);
		const res = await followTarget("u1", { type: "USER", id: "u2" });
		expect(res).toEqual({ ok: false, reason: "already_following" });
		expect(prisma.follow.create).not.toHaveBeenCalled();
	});

	test("PUBLIC user → a follow edge, no request", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({
			id: "u2",
			profileVisibility: ProfileVisibility.PUBLIC,
		} as never);
		const res = await followTarget("u1", { type: "USER", id: "u2" });
		expect(res).toEqual({ ok: true, status: "followed" });
		expect(prisma.follow.create).toHaveBeenCalledWith({
			data: {
				followerId: "u1",
				followerPageId: null,
				followingUserId: "u2",
				followingPageId: null,
			},
		});
		expect(prisma.accessRequest.create).not.toHaveBeenCalled();
	});

	test("PRIVATE user → a request, and no follow edge", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({
			id: "u2",
			profileVisibility: ProfileVisibility.PRIVATE,
		} as never);
		const res = await followTarget("u1", { type: "USER", id: "u2" });
		expect(res).toEqual({ ok: true, status: "requested" });
		expect(prisma.accessRequest.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				kind: "FOLLOW",
				requesterId: "u1",
				targetUserId: "u2",
			}),
		});
		expect(prisma.follow.create).not.toHaveBeenCalled();
	});

	test("PRIVATE page → a request, and no follow edge", async () => {
		vi.mocked(prisma.page.findUnique).mockResolvedValue({
			id: "p2",
			profileVisibility: ProfileVisibility.PRIVATE,
		} as never);
		const res = await followTarget("u1", { type: "PAGE", id: "p2" });
		expect(res).toEqual({ ok: true, status: "requested" });
		expect(prisma.accessRequest.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				kind: "FOLLOW",
				requesterId: "u1",
				targetPageId: "p2",
			}),
		});
		expect(prisma.follow.create).not.toHaveBeenCalled();
	});
});

describe("unfollowTarget", () => {
	test("deletes the follow edge and leaves requests alone", async () => {
		vi.mocked(prisma.follow.findUnique).mockResolvedValue({ id: "f1" } as never);
		const res = await unfollowTarget("u1", { type: "USER", id: "u2" });
		expect(res).toEqual({ ok: true });
		expect(prisma.follow.delete).toHaveBeenCalledWith({ where: { id: "f1" } });
		expect(prisma.accessRequest.deleteMany).not.toHaveBeenCalled();
	});

	test("no edge → cancels a pending request", async () => {
		vi.mocked(prisma.accessRequest.deleteMany).mockResolvedValue({ count: 1 } as never);
		const res = await unfollowTarget("u1", { type: "PAGE", id: "p2" });
		expect(res).toEqual({ ok: true });
		expect(prisma.follow.delete).not.toHaveBeenCalled();
		expect(prisma.accessRequest.deleteMany).toHaveBeenCalledWith({
			where: {
				kind: "FOLLOW",
				requesterId: "u1",
				requesterPageId: null,
				targetUserId: null,
				targetPageId: "p2",
			},
		});
	});

	test("nothing to remove → not ok", async () => {
		const res = await unfollowTarget("u1", { type: "USER", id: "u2" });
		expect(res).toEqual({ ok: false });
		expect(prisma.follow.delete).not.toHaveBeenCalled();
	});
});
