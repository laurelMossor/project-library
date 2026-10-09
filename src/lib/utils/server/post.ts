// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { PostItem, PostCollectionItem, PostCreateInput } from "@/lib/types/post";
import { postCollectionFields, postWithUserFields, toCollectionMeta } from "./fields";
import { getImagesForTargetsBatch, deleteAllAttachmentsForTarget } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ViewerContext } from "./visibility";
import { authorProfilePlacementWhere, collectionVisibilityWhere, draftsOnPageWhere, resolveParentVisibility, canViewEvent, canViewPost, isContentOwner, PROFILE_COLLECTION_VISIBILITY } from "./visibility";
import { canEditContent } from "./permission";
import { withCanPin } from "./pin";
import { PlacementError, PlacementForbiddenError, resolveContentPlacement } from "./content-placement";
import { ContentVisibility } from "@prisma/client";
import { DomainError } from "./domain-error";

/**
 * Fetch update posts attached to an event, sorted by createdAt (newest first).
 * Pass `viewer` to gate PRIVATE updates by the parent event's relationship
 * (defense-in-depth — the caller route also gates the event itself).
 */
export async function getEventUpdates(eventId: string, viewer?: ViewerContext): Promise<PostItem[]> {
	const event = await prisma.event.findUnique({
		where: { id: eventId },
		select: { id: true, userId: true, pageId: true, asPageId: true, contentVisibility: true },
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

/**
 * Fetch update posts attached to a parent post, sorted by createdAt (newest first).
 * Pass `viewer` to gate PRIVATE updates by the parent post's relationship
 * (defense-in-depth — the caller route also gates the parent itself).
 * The owner sees DRAFT updates; everyone else gets PUBLISHED only.
 */
export async function getPostUpdates(parentPostId: string, viewer?: ViewerContext): Promise<PostItem[]> {
	const parent = await prisma.post.findUnique({
		where: { id: parentPostId },
		select: { id: true, userId: true, pageId: true, asPageId: true, eventId: true, contentVisibility: true },
	});
	if (!parent) return [];

	const canSeePrivate = viewer
		? await canViewPost(parent, viewer)
		: parent.contentVisibility !== ContentVisibility.PRIVATE;

	const isOwner = viewer ? await isContentOwner(viewer, parent) : false;

	const posts = await prisma.post.findMany({
		where: {
			parentPostId,
			...(isOwner ? {} : { status: "PUBLISHED" as const }),
			...(canSeePrivate ? {} : { contentVisibility: { in: PROFILE_COLLECTION_VISIBILITY } }),
		},
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
	const personal = await collectionVisibilityWhere("USER", userId, viewer);
	const placed = await authorProfilePlacementWhere(viewer);
	const posts = await prisma.post.findMany({
		where: {
			userId,
			parentPostId: null,
			eventId: null,
			...(includeDrafts ? {} : { status: "PUBLISHED" }),
			OR: [{ pageId: null, ...personal }, placed],
		},
		select: postCollectionFields,
		orderBy: { createdAt: "desc" },
	});
	const postIds = posts.map((p) => p.id);
	const imagesMap = await getImagesForTargetsBatch("POST", postIds);
	return withCanPin(posts.map(({ _count, updates, ...p }) => ({
		...p,
		type: COLLECTION_TYPES.POST as "post",
		images: imagesMap.get(p.id) || [],
		...toCollectionMeta({ _count, updates }),
	})), viewer?.userId ?? null, { userId });
}

/**
 * Fetch a page's top-level published posts for public views.
 * Pass `includeDrafts: true` to also return page-spoken drafts and the viewer's own.
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
			...draftsOnPageWhere(includeDrafts, viewer),
			...(await collectionVisibilityWhere("PAGE", pageId, viewer)),
		},
		select: postCollectionFields,
		orderBy: { createdAt: "desc" },
	});
	const postIds = posts.map((p) => p.id);
	const imagesMap = await getImagesForTargetsBatch("POST", postIds);
	return withCanPin(posts.map(({ _count, updates, ...p }) => ({
		...p,
		type: COLLECTION_TYPES.POST as "post",
		images: imagesMap.get(p.id) || [],
		...toCollectionMeta({ _count, updates }),
	})), viewer?.userId ?? null, { pageId });
}

/**
 * Thrown for caller/client-fixable problems (bad references, missing permission,
 * invariant violations). Routes map this to a 400; anything else is a 500.
 */
export class PostInputError extends DomainError {}

/** Placement was refused because the caller may not post there. Routes map this to a 403. */
export class PostForbiddenError extends PostInputError {
	constructor(message: string) {
		super(message, "forbidden");
	}
}

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

	// A reply inherits placement from its parent (INV-3). An event update copies the
	// event and ignores the client. Otherwise the caller chooses who's speaking
	// (asPageId) and, when speaking as themselves, where it lives (pageId).
	let placement: { pageId: string | null; asPageId: string | null; showOnAuthorProfile: boolean } = {
		pageId: null,
		asPageId: null,
		showOnAuthorProfile: false,
	};

	if (data.parentPostId) {
		const parentPost = await prisma.post.findUnique({
			where: { id: data.parentPostId },
			select: { id: true, parentPostId: true, userId: true, pageId: true, asPageId: true, showOnAuthorProfile: true },
		});
		if (!parentPost) {
			throw new PostInputError("Parent post not found");
		}
		if (parentPost.parentPostId) {
			throw new PostInputError("Cannot nest posts more than one level deep");
		}
		if (!(await canEditContent(userId, parentPost))) {
			throw new PostInputError("You can only add updates to your own posts");
		}
		placement = await resolveContentPlacement(userId, { parent: parentPost });
	} else if (data.eventId) {
		// Event update: placement and voice come from the event. A client pageId must
		// not widen a private event onto a public page.
		const event = await prisma.event.findUnique({
			where: { id: data.eventId },
			select: { userId: true, pageId: true, asPageId: true, showOnAuthorProfile: true },
		});
		if (!event) {
			throw new PostInputError("Event not found");
		}
		if (!(await canEditContent(userId, event))) {
			throw new PostInputError("You can only add updates to your own events");
		}
		placement = {
			pageId: event.pageId,
			asPageId: event.asPageId,
			showOnAuthorProfile: event.showOnAuthorProfile,
		};
	} else {
		try {
			placement = await resolveContentPlacement(userId, {
				asPageId: data.asPageId,
				pageId: data.pageId,
				showOnAuthorProfile: data.showOnAuthorProfile,
			});
		} catch (err) {
			if (err instanceof PlacementForbiddenError) throw new PostForbiddenError(err.message);
			if (err instanceof PlacementError) throw new PostInputError(err.message);
			throw err;
		}
	}

	// A reply inherits its PARENT POST's visibility. An event update inherits the
	// EVENT's visibility (page argument null, so a public page cannot widen it).
	// Everything else derives from the page → user chain.
	const contentVisibility = data.parentPostId
		? await resolveParentVisibility(userId, null, null, data.parentPostId)
		: data.eventId
			? await resolveParentVisibility(userId, null, data.eventId, null)
			: await resolveParentVisibility(userId, placement.pageId, null, null);

	const post = await prisma.post.create({
		data: {
			userId,
			pageId: placement.pageId,
			asPageId: placement.asPageId,
			showOnAuthorProfile: placement.showOnAuthorProfile,
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
