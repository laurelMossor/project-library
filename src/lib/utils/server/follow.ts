// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { EntityRef } from "./activity";
import type { FollowCounts } from "@/lib/types/profile";
import type { ConnectionItem } from "@/lib/types/connections";
import { cancelFollowRequest, requestOrCreateFollow } from "./requests";
import { assertCanManagePage } from "./permission";
import { DomainError } from "./domain-error";

const followerUserSelect = {
	id: true,
	handle: true,
	displayName: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
} as const;

const followingUserSelect = followerUserSelect;

const followingPageSelect = {
	id: true,
	handle: true,
	name: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
} as const;

/** Users (and pages) who follow a given user */
export async function getUserFollowers(userId: string): Promise<ConnectionItem[]> {
	const rows = await prisma.follow.findMany({
		where: { followingUserId: userId },
		include: {
			follower: { select: followerUserSelect },
			followerPage: { select: followingPageSelect },
		},
		orderBy: { createdAt: "desc" },
	});

	return rows.map((row) => {
		if (row.followerPage) {
			return {
				id: row.id,
				type: "PAGE",
				followedAt: row.createdAt.toISOString(),
				user: null,
				page: row.followerPage,
			};
		}
		return {
			id: row.id,
			type: "USER",
			followedAt: row.createdAt.toISOString(),
			user: row.follower ?? null,
			page: null,
		};
	});
}

/** Users and pages that a given user follows */
export async function getUserFollowing(userId: string): Promise<ConnectionItem[]> {
	const rows = await prisma.follow.findMany({
		where: { followerId: userId },
		include: {
			followingUser: { select: followingUserSelect },
			followingPage: { select: followingPageSelect },
		},
		orderBy: { createdAt: "desc" },
	});

	return rows.map((row) => ({
		id: row.id,
		type: row.followingPage ? ("PAGE" as const) : ("USER" as const),
		followedAt: row.createdAt.toISOString(),
		user: row.followingUser ?? null,
		page: row.followingPage ?? null,
	}));
}

/** Users (and pages) who follow a given page */
export async function getPageFollowers(pageId: string): Promise<ConnectionItem[]> {
	const rows = await prisma.follow.findMany({
		where: { followingPageId: pageId },
		include: {
			follower: { select: followerUserSelect },
			followerPage: { select: followingPageSelect },
		},
		orderBy: { createdAt: "desc" },
	});

	return rows.map((row) => {
		if (row.followerPage) {
			return {
				id: row.id,
				type: "PAGE" as const,
				followedAt: row.createdAt.toISOString(),
				user: null,
				page: row.followerPage,
			};
		}
		return {
			id: row.id,
			type: "USER" as const,
			followedAt: row.createdAt.toISOString(),
			user: row.follower ?? null,
			page: null,
		};
	});
}

/** Users and pages that a given page follows */
export async function getPageFollowing(pageId: string): Promise<ConnectionItem[]> {
	const rows = await prisma.follow.findMany({
		where: { followerPageId: pageId },
		include: {
			followingUser: { select: followingUserSelect },
			followingPage: { select: followingPageSelect },
		},
		orderBy: { createdAt: "desc" },
	});

	return rows.map((row) => ({
		id: row.id,
		type: row.followingPage ? ("PAGE" as const) : ("USER" as const),
		followedAt: row.createdAt.toISOString(),
		user: row.followingUser ?? null,
		page: row.followingPage ?? null,
	}));
}

/** Follower / following counts for a profile — counts only, no rows fetched. */
export async function getFollowCounts(target: EntityRef): Promise<FollowCounts> {
	const isUser = target.type === "USER";
	const [followers, following] = await Promise.all([
		prisma.follow.count({ where: isUser ? { followingUserId: target.id } : { followingPageId: target.id } }),
		prisma.follow.count({ where: isUser ? { followerId: target.id } : { followerPageId: target.id } }),
	]);
	return { followers, following };
}

/** The current user's follow edge to a target, if any. Follows are initiated by users only. */
function findFollowEdge(userId: string, target: EntityRef) {
	return target.type === "USER"
		? prisma.follow.findUnique({
			where: { followerId_followingUserId: { followerId: userId, followingUserId: target.id } },
		})
		: prisma.follow.findUnique({
			where: { followerId_followingPageId: { followerId: userId, followingPageId: target.id } },
		});
}

export type FollowResult =
	| { ok: true; status: "followed" | "requested" }
	| { ok: false; reason: "self" | "not_found" | "already_following" };

/**
 * The current user follows a user or page. A PRIVATE target gets a pending
 * request instead of an edge (see requestOrCreateFollow).
 */
export async function followTarget(userId: string, target: EntityRef): Promise<FollowResult> {
	if (target.type === "USER" && target.id === userId) return { ok: false, reason: "self" };

	const found = target.type === "USER"
		? await prisma.user.findUnique({ where: { id: target.id }, select: { id: true, profileVisibility: true } })
		: await prisma.page.findUnique({ where: { id: target.id }, select: { id: true, profileVisibility: true } });
	if (!found) return { ok: false, reason: "not_found" };

	if (await findFollowEdge(userId, target)) return { ok: false, reason: "already_following" };

	const { status } = await requestOrCreateFollow(
		{ type: "USER", id: userId },
		{ type: target.type, id: found.id, profileVisibility: found.profileVisibility },
	);
	return { ok: true, status };
}

/** The current user unfollows a target, or cancels a pending follow request to it. */
export async function unfollowTarget(userId: string, target: EntityRef): Promise<{ ok: boolean }> {
	const follow = await findFollowEdge(userId, target);
	if (follow) {
		await prisma.follow.delete({ where: { id: follow.id } });
		return { ok: true };
	}
	return { ok: await cancelFollowRequest(userId, target) };
}

/** Which end of the edge `profile` must occupy for the delete to match. */
type FollowSide = "follower" | "followee";

/** Your own profile, or a page you manage. The message names the action the caller is attempting. */
async function assertOwnsProfile(actorId: string, profile: EntityRef, side: FollowSide): Promise<void> {
	if (profile.type === "USER") {
		if (profile.id !== actorId) {
			throw new DomainError(
				side === "followee"
					? "You can only remove followers from your own profile"
					: "You can only unfollow from your own profile",
				"forbidden",
			);
		}
		return;
	}
	await assertCanManagePage(actorId, profile.id);
}

/** The column that ties this edge to `profile` on `side`. */
function followOwnerWhere(profile: EntityRef, side: FollowSide) {
	if (side === "followee") {
		return profile.type === "USER" ? { followingUserId: profile.id } : { followingPageId: profile.id };
	}
	return profile.type === "USER" ? { followerId: profile.id } : { followerPageId: profile.id };
}

/**
 * Delete one follow edge that belongs to `profile` on `side`. The id alone is not enough: the
 * where clause keeps it from deleting someone else's edge.
 */
async function deleteOwnedFollow(actorId: string, profile: EntityRef, followId: string, side: FollowSide): Promise<void> {
	await assertOwnsProfile(actorId, profile, side);
	const { count } = await prisma.follow.deleteMany({
		where: { id: followId, ...followOwnerWhere(profile, side) },
	});
	if (count === 0) throw new DomainError("Follow relationship not found", "not_found");
}

/**
 * Remove someone from `profile`'s followers (by follow edge id). Your own profile, or a page you
 * manage. The edge must point at `profile`, so an id can't be used to delete anyone else's follow.
 */
export async function removeFollower(actorId: string, profile: EntityRef, followId: string): Promise<void> {
	await deleteOwnedFollow(actorId, profile, followId, "followee");
}

/**
 * Drop a follow `profile` itself made (by follow edge id). Your own profile, or a page you manage.
 * The edge must have `profile` as the follower, so a page's Following list can't delete the
 * signed-in user's personal follow of the same target.
 */
export async function unfollowEdge(actorId: string, profile: EntityRef, followId: string): Promise<void> {
	await deleteOwnedFollow(actorId, profile, followId, "follower");
}
