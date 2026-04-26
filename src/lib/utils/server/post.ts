// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { PostItem, PostCollectionItem, PostCreateInput, PostUpdateInput } from "@/lib/types/post";
import { postCollectionFields } from "./fields";
import { getImagesForTargetsBatch } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";

const postSelectFields = {
	id: true,
	userId: true,
	pageId: true,
	eventId: true,
	parentPostId: true,
	title: true,
	content: true,
	status: true,
	pinnedAt: true,
	tags: true,
	topics: true,
	createdAt: true,
	updatedAt: true,
	user: {
		select: {
			id: true,
			handle: true,
			displayName: true,
			firstName: true,
			lastName: true,
			avatarImageId: true,
		},
	},
	page: {
		select: {
			id: true,
			name: true,
			handle: true,
			avatarImageId: true,
		},
	},
};

/**
 * Fetch all posts for an event, sorted by createdAt (newest first)
 */
export async function getPostsForEvent(eventId: string): Promise<PostItem[]> {
	const posts = await prisma.post.findMany({
		where: { eventId },
		orderBy: { createdAt: "desc" },
		select: postSelectFields,
	});

	return posts as PostItem[];
}

/**
 * Fetch all posts for a page, sorted by createdAt (newest first)
 */
export async function getPostsForPage(pageId: string): Promise<PostItem[]> {
	const posts = await prisma.post.findMany({
		where: { pageId },
		orderBy: { createdAt: "desc" },
		select: postSelectFields,
	});

	return posts as PostItem[];
}

/**
 * Fetch all reply posts (updates) for a parent post, sorted by createdAt (newest first)
 */
export async function getPostUpdates(parentPostId: string): Promise<PostItem[]> {
	const posts = await prisma.post.findMany({
		where: { parentPostId },
		orderBy: { createdAt: "desc" },
		select: postSelectFields,
	});

	return posts as PostItem[];
}

/**
 * Fetch a user's top-level published posts for public views (explore, other users' profiles).
 * Pass `includeOwner: true` to also return drafts (for the author's own profile view).
 */
export async function getPostsByUser(userId: string, { includeOwner = false } = {}): Promise<PostCollectionItem[]> {
	const posts = await prisma.post.findMany({
		where: {
			userId,
			pageId: null,
			parentPostId: null,
			eventId: null,
			// TODO: where did includeOwner come from? It's not in the plan
			...(includeOwner ? {} : { status: "PUBLISHED" }),
		},
		select: postCollectionFields,
		orderBy: { createdAt: "desc" },
	});
	const postIds = posts.map((p) => p.id);
	const imagesMap = await getImagesForTargetsBatch("POST", postIds);
	return posts.map(({ _count, updates, ...p }) => ({
		...p,
		type: COLLECTION_TYPES.POST as "post",
		images: imagesMap.get(p.id) || [],
		_count: { updates: _count.updates },
		recentUpdate: updates[0] || null,
	}));
}

/**
 * Fetch a page's top-level published posts for public views.
 * Pass `includeOwner: true` to also return drafts (for page admins/editors).
 */
export async function getPostsByPage(pageId: string, { includeOwner = false } = {}): Promise<PostCollectionItem[]> {
	const posts = await prisma.post.findMany({
		where: {
			pageId,
			parentPostId: null,
			eventId: null,
			...(includeOwner ? {} : { status: "PUBLISHED" }),
		},
		select: postCollectionFields,
		orderBy: { createdAt: "desc" },
	});
	const postIds = posts.map((p) => p.id);
	const imagesMap = await getImagesForTargetsBatch("POST", postIds);
	return posts.map(({ _count, updates, ...p }) => ({
		...p,
		type: COLLECTION_TYPES.POST as "post",
		images: imagesMap.get(p.id) || [],
		_count: { updates: _count.updates },
		recentUpdate: updates[0] || null,
	}));
}

/**
 * Fetch all standalone posts (no pageId, eventId, or parentPostId), sorted by createdAt (newest first)
 */
export async function getStandalonePosts(userId?: string): Promise<PostItem[]> {
	const where = userId
		? { pageId: null, eventId: null, parentPostId: null, userId }
		: { pageId: null, eventId: null, parentPostId: null };

	const posts = await prisma.post.findMany({
		where,
		orderBy: { createdAt: "desc" },
		select: postSelectFields,
	});

	return posts as PostItem[];
}

/**
 * Get a post by ID
 */
export async function getPostById(postId: string): Promise<PostItem | null> {
	const post = await prisma.post.findUnique({
		where: { id: postId },
		select: postSelectFields,
	});

	return post as PostItem | null;
}

/**
 * Create a new post
 * Can be standalone (no pageId/eventId/parentPostId) or attached to a page/event/parent
 */
export async function createPost(
	userId: string,
	data: PostCreateInput
): Promise<PostItem> {
	// Validate content is not empty
	if (!data.content || data.content.trim().length === 0) {
		throw new Error("Content is required and cannot be empty");
	}

	// If eventId is set, verify event exists
	if (data.eventId) {
		const event = await prisma.event.findUnique({
			where: { id: data.eventId },
			select: { id: true },
		});
		if (!event) {
			throw new Error("Event not found");
		}
	}

	// If parentPostId is set, verify parent post exists
	if (data.parentPostId) {
		const parentPost = await prisma.post.findUnique({
			where: { id: data.parentPostId },
			select: { id: true },
		});
		if (!parentPost) {
			throw new Error("Parent post not found");
		}
	}

	// Create the post
	const post = await prisma.post.create({
		data: {
			userId,
			pageId: data.pageId || null,
			eventId: data.eventId || null,
			parentPostId: data.parentPostId || null,
			title: data.title?.trim() || null,
			content: data.content.trim(),
			tags: data.tags || [],
		},
		select: postSelectFields,
	});

	return post as PostItem;
}

/**
 * Update an existing post
 */
export async function updatePost(
	postId: string,
	data: PostUpdateInput
): Promise<PostItem> {
	const updateData: {
		title?: string | null;
		content?: string;
		tags?: string[];
	} = {};

	if (data.title !== undefined) {
		updateData.title = data.title?.trim() || null;
	}

	if (data.content !== undefined) {
		if (!data.content || data.content.trim().length === 0) {
			throw new Error("Content cannot be empty");
		}
		updateData.content = data.content.trim();
	}

	if (data.tags !== undefined) {
		updateData.tags = data.tags;
	}

	// Ensure we have at least one field to update
	if (Object.keys(updateData).length === 0) {
		throw new Error("No fields to update");
	}

	try {
		const post = await prisma.post.update({
			where: { id: postId },
			data: updateData,
			select: postSelectFields,
		});

		return post as PostItem;
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes("Record to update not found")) {
				throw new Error("Post not found");
			}
			throw error;
		}
		throw new Error("Failed to update post in database");
	}
}

/**
 * Delete a post
 */
export async function deletePost(postId: string): Promise<void> {
	await prisma.post.delete({
		where: { id: postId },
	});
}

/**
 * Create a minimal DRAFT post for the draft-then-inline-edit flow.
 * Called server-side when an owner navigates to /posts/new.
 */
export async function createDraftPost(userId: string, pageId?: string): Promise<PostItem> {
	const post = await prisma.post.create({
		data: {
			userId,
			pageId: pageId || null,
			content: "",
			status: "DRAFT",
		},
		select: postSelectFields,
	});
	return post as PostItem;
}

/**
 * Publish a post — flips status from DRAFT to PUBLISHED.
 */
export async function publishPost(postId: string): Promise<PostItem> {
	const post = await prisma.post.update({
		where: { id: postId },
		data: { status: "PUBLISHED" },
		select: postSelectFields,
	});
	return post as PostItem;
}
