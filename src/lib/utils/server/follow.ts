// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";

// Matches ConnectionItem type in ConnectionsView.tsx
type ConnectionItem = {
	id: string;
	type: "USER" | "PAGE";
	followedAt: string;
	user: {
		id: string;
		username: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		avatarImageId: string | null;
	} | null;
	page: {
		id: string;
		slug: string;
		name: string;
		avatarImageId: string | null;
	} | null;
};

const followerUserSelect = {
	id: true,
	username: true,
	displayName: true,
	firstName: true,
	lastName: true,
	avatarImageId: true,
} as const;

const followingUserSelect = followerUserSelect;

const followingPageSelect = {
	id: true,
	slug: true,
	name: true,
	avatarImageId: true,
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
