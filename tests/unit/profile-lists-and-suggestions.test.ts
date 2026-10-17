/**
 * Unit tests for the profile list gates and the Find people suggestions:
 *   - followers / following lists open for anyone who sees the FULL profile (never a LOCKED stub)
 *   - a page's member list opens for its members only
 *   - suggestions are PUBLIC profiles only, never the viewer or a page they hold a role on,
 *     unfollowed profiles first
 * Prisma and the permission/follow layers are mocked so no DB or auth is required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ViewerContext } from "@/lib/utils/server/visibility";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		user: { findMany: vi.fn(), findUnique: vi.fn() },
		page: { findMany: vi.fn(), findUnique: vi.fn() },
		follow: { findMany: vi.fn(), findFirst: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/permission", () => ({
	canEditContent: vi.fn(),
	getMemberPageIds: vi.fn(),
	getMemberPageIdsForUsers: vi.fn(),
	getResourcePermissions: vi.fn(),
}));
vi.mock("@/lib/utils/server/follow", () => ({
	getUserFollowers: vi.fn(),
	getUserFollowing: vi.fn(),
	getPageFollowers: vi.fn(),
	getPageFollowing: vi.fn(),
}));

import { prisma } from "@/lib/utils/server/prisma";
import { getResourcePermissions } from "@/lib/utils/server/permission";
import { getPageFollowers, getUserFollowers } from "@/lib/utils/server/follow";
import { canViewFollowList, canViewMemberList, profileSuggestionWhere } from "@/lib/utils/server/visibility";
import { listProfileConnections } from "@/lib/utils/server/profile-lists";
import { pickSuggestions, suggestProfiles } from "@/lib/utils/server/search";

const p = prisma as any;
const ANON: ViewerContext = { userId: null, memberPageIds: [] };
const MEMBER: ViewerContext = { userId: "alice", memberPageIds: ["guild"] };
const STRANGER: ViewerContext = { userId: "sam", memberPageIds: [] };

beforeEach(() => {
	vi.clearAllMocks();
	p.follow.findFirst.mockResolvedValue(null);
});

describe("list gates", () => {
	test("followers/following open only on a FULL profile", () => {
		expect(canViewFollowList("FULL")).toBe(true);
		expect(canViewFollowList("LOCKED")).toBe(false);
	});

	test("the member list is members only", () => {
		expect(canViewMemberList(MEMBER, "guild")).toBe(true);
		expect(canViewMemberList(STRANGER, "guild")).toBe(false);
		expect(canViewMemberList(ANON, "guild")).toBe(false);
	});
});

describe("listProfileConnections", () => {
	test("anonymous viewers can open a PUBLIC profile's followers", async () => {
		p.user.findUnique.mockResolvedValue({ id: "pat", profileVisibility: "PUBLIC" });
		vi.mocked(getUserFollowers).mockResolvedValue([
			{ id: "f1", type: "USER", followedAt: "", user: { id: "sam", handle: "sam", displayName: "Sam", avatarImageId: null }, page: null },
		]);
		const people = await listProfileConnections(ANON, { type: "USER", id: "pat" }, "followers");
		expect(people.map((x) => x.id)).toEqual(["sam"]);
	});

	test("a LOCKED (PRIVATE, no edge) profile refuses its follower list", async () => {
		p.user.findUnique.mockResolvedValue({ id: "pat", profileVisibility: "PRIVATE" });
		await expect(listProfileConnections(STRANGER, { type: "USER", id: "pat" }, "followers")).rejects.toMatchObject({
			code: "forbidden",
		});
		expect(getUserFollowers).not.toHaveBeenCalled();
	});

	test("a page's members: members get the list, strangers are refused before any read", async () => {
		p.page.findUnique.mockResolvedValue({ id: "guild", profileVisibility: "PUBLIC" });
		vi.mocked(getResourcePermissions).mockResolvedValue([
			{ user: { id: "alice", handle: "alice", displayName: "Alice", avatarImageId: null } },
		] as never);

		const members = await listProfileConnections(MEMBER, { type: "PAGE", id: "guild" }, "members");
		expect(members.map((x) => x.id)).toEqual(["alice"]);

		vi.mocked(getResourcePermissions).mockClear();
		await expect(listProfileConnections(STRANGER, { type: "PAGE", id: "guild" }, "members")).rejects.toMatchObject({
			code: "forbidden",
		});
		expect(getResourcePermissions).not.toHaveBeenCalled();
	});

	test("a stranger may still open a PUBLIC page's followers", async () => {
		p.page.findUnique.mockResolvedValue({ id: "guild", profileVisibility: "PUBLIC" });
		vi.mocked(getPageFollowers).mockResolvedValue([]);
		await expect(listProfileConnections(STRANGER, { type: "PAGE", id: "guild" }, "followers")).resolves.toEqual([]);
	});

	test("a missing profile is not_found", async () => {
		p.user.findUnique.mockResolvedValue(null);
		await expect(listProfileConnections(ANON, { type: "USER", id: "nope" }, "followers")).rejects.toMatchObject({
			code: "not_found",
		});
	});

	test("users have no member list", async () => {
		p.user.findUnique.mockResolvedValue({ id: "pat", profileVisibility: "PUBLIC" });
		await expect(listProfileConnections(MEMBER, { type: "USER", id: "pat" }, "members")).rejects.toMatchObject({
			code: "invalid",
		});
	});
});

describe("suggestions", () => {
	test("the rule filters to PUBLIC profiles", () => {
		expect(profileSuggestionWhere("USER")).toEqual({ profileVisibility: "PUBLIC" });
		expect(profileSuggestionWhere("PAGE")).toEqual({ profileVisibility: "PUBLIC" });
	});

	test("unfollowed come first, followed after, capped at count", () => {
		const picked = pickSuggestions(
			[
				{ type: "user", id: "a", followed: true },
				{ type: "user", id: "b", followed: false },
				{ type: "page", id: "c", followed: true },
				{ type: "user", id: "d", followed: false },
				{ type: "page", id: "e", followed: false },
			],
			4,
			() => 0.5,
		);
		expect(picked).toHaveLength(4);
		expect(picked.slice(0, 3).every((c) => !c.followed)).toBe(true);
		expect(picked[3].followed).toBe(true);
	});

	test("a short pool just returns what there is", () => {
		expect(pickSuggestions([{ type: "user", id: "a", followed: false }], 5)).toHaveLength(1);
	});

	test("the query excludes the viewer and pages they hold a role on, and asks for PUBLIC only", async () => {
		p.user.findMany.mockResolvedValueOnce([{ id: "pat" }]).mockResolvedValueOnce([]);
		p.page.findMany.mockResolvedValueOnce([{ id: "club" }]).mockResolvedValueOnce([]);
		p.follow.findMany.mockResolvedValue([{ followingUserId: "pat", followingPageId: null }]);

		await suggestProfiles(MEMBER);

		const userWhere = p.user.findMany.mock.calls[0][0].where.AND;
		expect(userWhere).toContainEqual({ profileVisibility: "PUBLIC" });
		expect(userWhere).toContainEqual({ id: { not: "alice" } });
		const pageWhere = p.page.findMany.mock.calls[0][0].where.AND;
		expect(pageWhere).toContainEqual({ profileVisibility: "PUBLIC" });
		expect(pageWhere).toContainEqual({ id: { notIn: ["guild"] } });
	});

	test("anonymous viewers get suggestions with no exclusions or follow lookup", async () => {
		p.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		p.page.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		await expect(suggestProfiles(ANON)).resolves.toEqual([]);
		expect(p.follow.findMany).not.toHaveBeenCalled();
	});
});
