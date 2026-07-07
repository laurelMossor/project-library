// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { PostItem, PostCollectionItem, PostCreateInput } from "@/lib/types/post";
import { postCollectionFields, postWithUserFields } from "./fields";
import { getImagesForTargetsBatch } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ViewerContext } from "./visibility";
import { collectionVisibilityWhere, resolveParentVisibility, canViewEvent, isContentOwner, PROFILE_COLLECTION_VISIBILITY } from "./visibility";
import { ContentVisibility } from "@prisma/client";

/**
 * Fetch update posts attached to an event, sorted by createdAt (newest first).
 * Pass `viewer` to gate PRIVATE updates by the parent event's relationship
 * (defense-in-depth — the caller route also gates the event itself).
 */
export async function getEventUpdates(eventId: string, viewer?: ViewerContext): Promise<PostItem[]> {
	const event = await prisma.event.findUnique({
		where: { id: eventId },
		select: { id: true, userId: true, pageId: true, contentVisibility: true },
	});
	if (!event) return [];

	const canSeePrivate = viewer
		? await canViewEvent(event, viewer)
		: event.contentVisibility !== ContentVisibility.PRIVATE;

	// Only the event owner (author or page manager) sees DRAFT child updates; everyone else
	// is limited to PUBLISHED, so a published event's unfinished draft update can't leak here
	// (finding 4 — GET /api/events/[id]/posts).
	const isOwner = viewer ? await isContentOwner(viewer, event) : false;

	const posts = await prisma.post.findMany({
		where: {
			eventId,
			...(isOwner ? {} : { status: "PUBLISHED" as const }),
			...(canSeePrivate ? {} : { contentVisibility: { in: PROFILE_COLLECTION_VISIBILITY } }),
		},
		orderBy: { createdAt: "desc" },
		select: postWithUserFields,
	});
	return posts as PostItem[];
}

/** Fetch reply posts (updates) for a parent post, sorted by createdAt (newest first) */
export async function getPostUpdates(parentPostId: string): Promise<PostItem[]> {
	const posts = await prisma.post.findMany({
		where: { parentPostId },
		orderBy: { createdAt: "desc" },
		select: postWithUserFields,
	});
	return posts as PostItem[];
}

/**
 * Fetch a user's top-level published posts for public views (explore, other users' profiles).
 * Pass `includeDrafts: true` to also return drafts (for the author's own profile view).
 * Pass `viewer` to apply visibility filtering (omit only when caller already knows viewer is owner).
 */
export async function getPostsByUser(
	userId: string,
	{ includeDrafts = false, viewer }: { includeDrafts?: boolean; viewer?: ViewerContext } = {}
): Promise<PostCollectionItem[]> {
	const posts = await prisma.post.findMany({
		where: {
			userId,
			pageId: null,
			parentPostId: null,
			eventId: null,
			...(includeDrafts ? {} : { status: "PUBLISHED" }),
			...(await collectionVisibilityWhere("USER", userId, viewer)),
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
 * Pass `includeDrafts: true` to also return drafts (for page admins/editors).
 * Pass `viewer` to apply visibility filtering (omit only when caller already knows viewer is a member).
 */
export async function getPostsByPage(
	pageId: string,
	{ includeDrafts = false, viewer }: { includeDrafts?: boolean; viewer?: ViewerContext } = {}
): Promise<PostCollectionItem[]> {
	const posts = await prisma.post.findMany({
		where: {
			pageId,
			parentPostId: null,
			eventId: null,
			...(includeDrafts ? {} : { status: "PUBLISHED" }),
			...(await collectionVisibilityWhere("PAGE", pageId, viewer)),
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

	// A reply inherits its page from the parent (INV-3); a client-supplied pageId is only
	// meaningful for non-reply posts.
	let effectivePageId: string | null = data.parentPostId ? null : data.pageId || null;

	// If parentPostId is set, verify parent post exists and adopt its page context
	if (data.parentPostId) {
		const parentPost = await prisma.post.findUnique({
			where: { id: data.parentPostId },
			select: { id: true, pageId: true },
		});
		if (!parentPost) {
			throw new Error("Parent post not found");
		}
		effectivePageId = parentPost.pageId;
	}

	const contentVisibility = await resolveParentVisibility(userId, effectivePageId, data.eventId, data.parentPostId);

	// Create the post
	const post = await prisma.post.create({
		data: {
			userId,
			pageId: effectivePageId,
			eventId: data.eventId || null,
			parentPostId: data.parentPostId || null,
			title: data.title?.trim() || null,
			content: data.content.trim(),
			tags: data.tags || [],
			contentVisibility,
		},
		select: postWithUserFields,
	});

	return post as PostItem;
}

// NOTE: post updates go through `PATCH /api/posts/:id`, which owns validation, permission, and
// re-parent-visibility logic. The former `updatePost` server util here was unused (the client
// `post-client.ts` has its own same-named fetch wrapper) and was removed to avoid a second write path.

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
 * Inherits visibility from the parent page (or user if standalone).
 */
export async function createDraftPost(userId: string, pageId?: string): Promise<PostItem> {
	const contentVisibility = await resolveParentVisibility(userId, pageId);
	const post = await prisma.post.create({
		data: {
			userId,
			pageId: pageId || null,
			content: "",
			status: "DRAFT",
			contentVisibility,
		},
		select: postWithUserFields,
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
		select: postWithUserFields,
	});
	return post as PostItem;
}
