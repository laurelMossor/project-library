// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { PostItem, PostCollectionItem, PostCreateInput } from "@/lib/types/post";
import { postCollectionFields, postWithUserFields, toCollectionMeta } from "./fields";
import { getImagesForTargetsBatch, deleteAllAttachmentsForTarget } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ViewerContext } from "./visibility";
import { collectionVisibilityWhere, resolveParentVisibility, canViewEvent, isContentOwner, PROFILE_COLLECTION_VISIBILITY } from "./visibility";
import { canPostAsPage } from "./permission";
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
		...toCollectionMeta({ _count, updates }),
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
		...toCollectionMeta({ _count, updates }),
	}));
}

/**
 * Thrown for caller/client-fixable problems (bad references, missing permission,
 * invariant violations). Routes map this to a 400; anything else is a 500.
 */
export class PostInputError extends Error {}

type CreatePostData = PostCreateInput & {
	topics?: string[];
	/** Draft creation (from /posts/new) allows empty content. */
	isDraft?: boolean;
};

/**
 * Create a post — the single guarded write path for post creation. Standalone, on a page,
 * an event update, or a reply. Enforces the invariants at the choke point rather than in
 * each route (INV-1/2/3/8): a post is an event-update XOR a reply; replies are one level
 * deep and inherit their parent's page; page-authored posts require ADMIN/EDITOR.
 */
export async function createPost(
	userId: string,
	data: CreatePostData
): Promise<PostItem> {
	// INV-1: a post is an event update XOR a reply, never both.
	if (data.eventId && data.parentPostId) {
		throw new PostInputError("A post cannot be both an event update and a reply");
	}

	// Draft creation may start empty; everything else needs content.
	if (!data.isDraft && (!data.content || data.content.trim().length === 0)) {
		throw new PostInputError("Content is required and cannot be empty");
	}

	// A reply inherits its page from the parent (INV-3); a client-supplied pageId is only
	// meaningful for non-reply posts. effectivePageId is the value actually written.
	let effectivePageId: string | null = data.parentPostId ? null : data.pageId || null;

	if (data.parentPostId) {
		// Reply: parent must exist, be top-level (INV-2), and be owned by the caller.
		const parentPost = await prisma.post.findUnique({
			where: { id: data.parentPostId },
			select: { id: true, parentPostId: true, userId: true, pageId: true },
		});
		if (!parentPost) {
			throw new PostInputError("Parent post not found");
		}
		if (parentPost.parentPostId) {
			throw new PostInputError("Cannot nest posts more than one level deep");
		}
		const parentOwned = parentPost.pageId
			? await canPostAsPage(userId, parentPost.pageId)
			: parentPost.userId === userId;
		if (!parentOwned) {
			throw new PostInputError("You can only add updates to your own posts");
		}
		effectivePageId = parentPost.pageId;
	} else if (data.pageId) {
		// Page-authored post (INV-8): caller must hold ADMIN/EDITOR on the page.
		if (!(await canPostAsPage(userId, data.pageId))) {
			throw new PostInputError("You don't have permission to post as this page");
		}
	}

	if (data.eventId) {
		// Event update: event must exist and be owned by the caller.
		const event = await prisma.event.findUnique({
			where: { id: data.eventId },
			select: { userId: true },
		});
		if (!event) {
			throw new PostInputError("Event not found");
		}
		if (event.userId !== userId) {
			throw new PostInputError("Cannot create post for an event you don't own");
		}
	}

	// A reply inherits its PARENT POST's visibility, not the page's — this matches what
	// syncDescendantVisibility("POST", ...) writes on a re-parent, and stays correct if a
	// future per-item override ever lets a post's visibility diverge from its page. For
	// non-replies, derive from the (effective) page → event → user chain as usual.
	const contentVisibility = data.parentPostId
		? await resolveParentVisibility(userId, null, null, data.parentPostId)
		: await resolveParentVisibility(userId, effectivePageId, data.eventId, null);

	const post = await prisma.post.create({
		data: {
			userId,
			pageId: effectivePageId,
			eventId: data.eventId || null,
			parentPostId: data.parentPostId || null,
			title: data.title?.trim() || null,
			content: data.content?.trim() || "",
			tags: data.tags || [],
			topics: data.topics || [],
			contentVisibility,
			// Posts are born DRAFT (schema default) and published via PATCH /api/posts/:id;
			// isDraft is explicit only for clarity at the draft-then-edit entry point.
			...(data.isDraft ? { status: "DRAFT" as const } : {}),
		},
		select: postWithUserFields,
	});

	return post as PostItem;
}

// NOTE: post updates go through `PATCH /api/posts/:id`, which owns validation, permission, and
// re-parent-visibility logic. The former `updatePost` server util here was unused (the client
// `post-client.ts` has its own same-named fetch wrapper) and was removed to avoid a second write path.
//
// NOTE: the former `createDraftPost` and `publishPost` server utils were removed — both were
// unused (zero server callers) and unguarded. Their real entry points are the client wrappers in
// `post-client.ts`: draft creation hits `POST /api/posts` with `{ isDraft: true }` (→ createPost
// above), and publish hits `PATCH /api/posts/:id` with `{ status: "PUBLISHED" }` (which validates
// non-empty content). Rebuild here with guards baked in if a server-side caller is ever needed.

/**
 * Delete a post and clean up its attached images.
 *
 * ImageAttachment is polymorphic (no real FK to Post), so nothing cascades — without this
 * the post's attachments, Image rows, and storage blobs would all be orphaned. Callers
 * must authorize the delete first (the DELETE /api/posts/:id route does).
 */
export async function deletePost(postId: string): Promise<void> {
	await deleteAllAttachmentsForTarget("POST", postId);
	await prisma.post.delete({
		where: { id: postId },
	});
}
