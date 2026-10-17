// ⚠️ SERVER-ONLY: Profile search utility
import { prisma } from "./prisma";
import { ProfileVisibility, type Prisma } from "@prisma/client";
import type { SearchResultItem } from "@/lib/types/search";
import { profileListWhere, profileSuggestionWhere, type ViewerContext } from "./visibility";

const ANON_VIEWER: ViewerContext = { userId: null, memberPageIds: [] };

// PRIVATE profiles are discoverable in search but render as identity-only stubs — their
// headline/interests must not ride along. (See the LOCKED profile stub.)
const isPrivate = (v: ProfileVisibility) => v === ProfileVisibility.PRIVATE;

const searchUserFields = {
	id: true,
	handle: true,
	displayName: true,
	headline: true,
	interests: true,
	profileVisibility: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
} as const;

const searchPageFields = {
	id: true,
	handle: true,
	name: true,
	headline: true,
	interests: true,
	profileVisibility: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
} as const;

type SearchUserRow = Prisma.UserGetPayload<{ select: typeof searchUserFields }>;
type SearchPageRow = Prisma.PageGetPayload<{ select: typeof searchPageFields }>;

function toUserResult(u: SearchUserRow): SearchResultItem {
	return {
		type: "user",
		id: u.id,
		handle: u.handle,
		name: u.displayName ?? u.handle,
		headline: isPrivate(u.profileVisibility) ? null : u.headline,
		interests: isPrivate(u.profileVisibility) ? [] : u.interests,
		profileVisibility: u.profileVisibility,
		avatarImageId: u.avatarImageId,
		avatarImage: u.avatarImage,
	};
}

function toPageResult(p: SearchPageRow): SearchResultItem {
	return {
		type: "page",
		id: p.id,
		handle: p.handle,
		name: p.name,
		headline: isPrivate(p.profileVisibility) ? null : p.headline,
		interests: isPrivate(p.profileVisibility) ? [] : p.interests,
		profileVisibility: p.profileVisibility,
		avatarImageId: p.avatarImageId,
		avatarImage: p.avatarImage,
	};
}

type SearchProfilesOptions = {
	type?: "user" | "page" | "all";
	limit?: number;
	viewer?: ViewerContext;
};

export async function searchProfiles(
	query: string,
	{ type = "all", limit = 12, viewer = ANON_VIEWER }: SearchProfilesOptions = {}
): Promise<SearchResultItem[]> {
	if (query.length < 2) return [];

	const filter = { contains: query, mode: "insensitive" as const };

	const results: SearchResultItem[] = [];

	if (type === "all" || type === "user") {
		const users = await prisma.user.findMany({
			where: {
				AND: [
					profileListWhere("USER", viewer),
					{
						OR: [
							{ handle: filter },
							{ displayName: filter },
							{ firstName: filter },
							{ lastName: filter },
						],
					},
				],
			},
			select: searchUserFields,
			take: limit,
			orderBy: { displayName: "asc" },
		});

		results.push(...users.map(toUserResult));
	}

	if (type === "all" || type === "page") {
		const pages = await prisma.page.findMany({
			where: {
				AND: [
					profileListWhere("PAGE", viewer),
					{
						OR: [
							{ handle: filter },
							{ name: filter },
						],
					},
				],
			},
			select: searchPageFields,
			take: limit,
			orderBy: { name: "asc" },
		});

		results.push(...pages.map(toPageResult));
	}

	return results.slice(0, limit);
}

/**
 * Profiles that share a follow edge with `identity` in either direction (it follows them, or they
 * follow it) — the "people you know" list for picking group members. Same result shape, profile-list
 * gate, and PRIVATE stub-stripping as `searchProfiles`. `identity` itself is never included. Bounded to
 * the most recent `limit` edges so a page with thousands of followers stays cheap.
 */
export async function getFollowConnectedProfiles(
	identity: { type: "user" | "page"; id: string },
	viewer: ViewerContext = ANON_VIEWER,
	limit = 50,
): Promise<SearchResultItem[]> {
	const self = identity.type === "user"
		? { out: { followerId: identity.id }, in: { followingUserId: identity.id } }
		: { out: { followerPageId: identity.id }, in: { followingPageId: identity.id } };
	const edges = await prisma.follow.findMany({
		where: { OR: [self.out, self.in] },
		select: { followerId: true, followerPageId: true, followingUserId: true, followingPageId: true },
		orderBy: { createdAt: "desc" },
		take: limit,
	});

	const userIds = new Set<string>();
	const pageIds = new Set<string>();
	for (const e of edges) {
		for (const [uid, pid] of [[e.followerId, e.followerPageId], [e.followingUserId, e.followingPageId]]) {
			if (uid && !(identity.type === "user" && uid === identity.id)) userIds.add(uid);
			if (pid && !(identity.type === "page" && pid === identity.id)) pageIds.add(pid);
		}
	}

	const [users, pages] = await Promise.all([
		userIds.size
			? prisma.user.findMany({
				where: { AND: [profileListWhere("USER", viewer), { id: { in: [...userIds] } }] },
				select: searchUserFields,
				orderBy: { displayName: "asc" },
				take: limit,
			})
			: [],
		pageIds.size
			? prisma.page.findMany({
				where: { AND: [profileListWhere("PAGE", viewer), { id: { in: [...pageIds] } }] },
				select: searchPageFields,
				orderBy: { name: "asc" },
				take: limit,
			})
			: [],
	]);
	return [...users.map(toUserResult), ...pages.map(toPageResult)].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Suggestions — "who's on the app", shown on Find people before anyone types.
// ---------------------------------------------------------------------------

/** Upper bound on candidate ids read per kind. Plenty for beta; revisit with a real ranking. */
const SUGGESTION_CANDIDATE_CAP = 2000;

export type SuggestionCandidate = { type: "user" | "page"; id: string; followed: boolean };

/**
 * Pick `count` candidates at random, profiles the viewer doesn't follow first. Within each group the
 * order is a uniform shuffle. Pure (the random source is injectable) so the rule is testable.
 */
export function pickSuggestions(
	candidates: SuggestionCandidate[],
	count: number,
	random: () => number = Math.random,
): SuggestionCandidate[] {
	const shuffle = <T,>(items: T[]): T[] => {
		const out = [...items];
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	};
	return [
		...shuffle(candidates.filter((c) => !c.followed)),
		...shuffle(candidates.filter((c) => c.followed)),
	].slice(0, count);
}

/**
 * A few people and pages to show before any search: PUBLIC profiles only (`profileSuggestionWhere`),
 * never the viewer or a page they hold a role on, those they don't already follow first. Works for
 * an anonymous viewer (nothing is excluded or followed).
 */
export async function suggestProfiles(
	viewer: ViewerContext = ANON_VIEWER,
	count = 5,
): Promise<SearchResultItem[]> {
	const [userIds, pageIds, edges] = await Promise.all([
		prisma.user.findMany({
			where: {
				AND: [
					profileSuggestionWhere("USER"),
					{ setupCompletedAt: { not: null } },
					viewer.userId ? { id: { not: viewer.userId } } : {},
				],
			},
			select: { id: true },
			take: SUGGESTION_CANDIDATE_CAP,
		}),
		prisma.page.findMany({
			where: {
				AND: [
					profileSuggestionWhere("PAGE"),
					viewer.memberPageIds.length ? { id: { notIn: viewer.memberPageIds } } : {},
				],
			},
			select: { id: true },
			take: SUGGESTION_CANDIDATE_CAP,
		}),
		viewer.userId
			? prisma.follow.findMany({
				where: { followerId: viewer.userId },
				select: { followingUserId: true, followingPageId: true },
			})
			: [],
	]);

	const followedUsers = new Set(edges.flatMap((e) => (e.followingUserId ? [e.followingUserId] : [])));
	const followedPages = new Set(edges.flatMap((e) => (e.followingPageId ? [e.followingPageId] : [])));
	const picked = pickSuggestions(
		[
			...userIds.map((u) => ({ type: "user" as const, id: u.id, followed: followedUsers.has(u.id) })),
			...pageIds.map((p) => ({ type: "page" as const, id: p.id, followed: followedPages.has(p.id) })),
		],
		count,
	);
	if (picked.length === 0) return [];

	const [users, pages] = await Promise.all([
		prisma.user.findMany({
			where: { id: { in: picked.filter((c) => c.type === "user").map((c) => c.id) } },
			select: searchUserFields,
		}),
		prisma.page.findMany({
			where: { id: { in: picked.filter((c) => c.type === "page").map((c) => c.id) } },
			select: searchPageFields,
		}),
	]);
	const byKey = new Map<string, SearchResultItem>([
		...users.map((u): [string, SearchResultItem] => [`user:${u.id}`, toUserResult(u)]),
		...pages.map((p): [string, SearchResultItem] => [`page:${p.id}`, toPageResult(p)]),
	]);
	// Keep the picked order (unfollowed first); a row deleted between the two reads just drops out.
	return picked.flatMap((c) => byKey.get(`${c.type}:${c.id}`) ?? []);
}
