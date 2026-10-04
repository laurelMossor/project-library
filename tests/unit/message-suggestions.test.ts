/**
 * Unit tests for getFollowConnectedProfiles — the group-member suggestions. It must include identities
 * on EITHER side of a follow edge, never the acting identity itself, strip PRIVATE profiles to their
 * identity stub (no headline/interests — same rule as profile search), and stay bounded.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		follow: { findMany: vi.fn() },
		user: { findMany: vi.fn() },
		page: { findMany: vi.fn() },
	},
}));

import { getFollowConnectedProfiles } from "@/lib/utils/server/search";
import { prisma } from "@/lib/utils/server/prisma";

const p = prisma as any;
const user = (id: string, vis: "PUBLIC" | "PRIVATE" = "PUBLIC") => ({
	id, handle: id, displayName: id.toUpperCase(), headline: `${id} headline`, interests: ["knitting"],
	profileVisibility: vis, avatarImageId: null, avatarImage: null,
});

beforeEach(() => {
	vi.clearAllMocks();
	p.page.findMany.mockResolvedValue([]);
});

describe("getFollowConnectedProfiles", () => {
	test("both follow directions, never yourself", async () => {
		p.follow.findMany.mockResolvedValue([
			{ followerId: "alice", followerPageId: null, followingUserId: "sam", followingPageId: null }, // alice → sam
			{ followerId: "pat", followerPageId: null, followingUserId: "alice", followingPageId: null }, // pat → alice
			{ followerId: "alice", followerPageId: null, followingUserId: null, followingPageId: "guild" }, // alice → guild
		]);
		p.user.findMany.mockResolvedValue([user("pat"), user("sam")]);
		p.page.findMany.mockResolvedValue([{ id: "guild", handle: "guild", name: "Guild", headline: null, interests: [], profileVisibility: "PUBLIC", avatarImageId: null, avatarImage: null }]);

		const results = await getFollowConnectedProfiles({ type: "user", id: "alice" });

		const edgeWhere = p.follow.findMany.mock.calls[0][0];
		expect(edgeWhere.where).toEqual({ OR: [{ followerId: "alice" }, { followingUserId: "alice" }] });
		expect(edgeWhere.take).toBe(50); // bounded — a popular page doesn't load every follower
		const userIds = p.user.findMany.mock.calls[0][0].where.AND[1].id.in.sort();
		expect(userIds).toEqual(["pat", "sam"]); // alice herself excluded
		expect(results.map((r) => `${r.type}:${r.id}`)).toEqual(["user:pat", "user:sam", "page:guild"]);
	});

	test("a page identity matches its own page-side edges and excludes itself", async () => {
		p.follow.findMany.mockResolvedValue([
			{ followerId: "sam", followerPageId: null, followingUserId: null, followingPageId: "guild" },
		]);
		p.user.findMany.mockResolvedValue([user("sam")]);
		await getFollowConnectedProfiles({ type: "page", id: "guild" });
		expect(p.follow.findMany.mock.calls[0][0].where).toEqual({ OR: [{ followerPageId: "guild" }, { followingPageId: "guild" }] });
		expect(p.page.findMany).not.toHaveBeenCalled(); // the guild itself is never suggested
	});

	test("PRIVATE profiles come back as identity-only stubs", async () => {
		p.follow.findMany.mockResolvedValue([
			{ followerId: "pat", followerPageId: null, followingUserId: "alice", followingPageId: null },
		]);
		p.user.findMany.mockResolvedValue([user("pat", "PRIVATE")]);
		const [pat] = await getFollowConnectedProfiles({ type: "user", id: "alice" });
		expect(pat).toMatchObject({ id: "pat", name: "PAT", headline: null, interests: [] });
	});

	test("no edges → no profile queries", async () => {
		p.follow.findMany.mockResolvedValue([]);
		expect(await getFollowConnectedProfiles({ type: "user", id: "alice" })).toEqual([]);
		expect(p.user.findMany).not.toHaveBeenCalled();
	});
});
