// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import type { PostItem, PostCollectionItem, PostCreateInput, PostUpdateData } from "@/lib/types/post";
import { postCollectionFields, postWithUserFields, toCollectionMeta } from "./fields";
import { getImagesForTargetsBatch, deleteAllAttachmentsForTarget } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ViewerContext } from "./visibility";
import { authorProfilePlacementWhere, collectionVisibilityWhere, draftsOnPageWhere, resolveParentVisibility, canViewEvent, canViewPost, isContentOwner, PROFILE_COLLECTION_VISIBILITY, requireViewablePost, syncDescendantVisibility } from "./visibility";
import { canEditContent, canModerateContent } from "./permission";
import { assertPinChange, canPinContent, withCanPin } from "./pin";
import { PlacementError, PlacementForbiddenError, resolveContentPlacement } from "./content-placement";
import { AttachmentTarget, ContentVisibility, type Prisma } from "@prisma/client";
import { postHasContent } from "@/lib/utils/content";
import { validatePostUpdateData } from "@/lib/validations";
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

/**
 * Update a post as the viewer — the single write path for edits, publish, placement, and pins.
 * Not viewable → not_found (no existence oracle). Pin-only changes need pin rights on the
 * post's page; everything else needs edit rights. Placement can change only while a top-level
 * post is a draft, and re-parenting re-derives visibility for the post and its replies.
 */
export async function updatePost(viewer: ViewerContext & { userId: string }, id: string, data: PostUpdateData): Promise<void> {
	const existing = await requireViewablePost(id, viewer);
	if (!existing) throw new PostInputError("Post not found", "not_found");

	// Pinning on a page is a manage action, separate from editing the words.
	// A page manager may pin a member's post; the member may not.
	const pinOnly = data.pinnedAt !== undefined
		&& Object.keys(data).every((key) => key === "pinnedAt")
		&& (await canPinContent(viewer.userId, { userId: existing.userId, pageId: existing.pageId }));
	if (!pinOnly && !(await canEditContent(viewer.userId, existing))) {
		throw new PostForbiddenError("You can only edit your own posts");
	}

	const { title, content, tags, topics, pinnedAt, status, pageId, asPageId, showOnAuthorProfile } = data;

	let placement: { pageId: string | null; asPageId: string | null; showOnAuthorProfile: boolean } | null = null;
	if (pageId !== undefined || asPageId !== undefined || showOnAuthorProfile !== undefined) {
		if (existing.parentPostId) throw new PostInputError("A reply inherits its page from its parent post and cannot be moved");
		if (existing.eventId) throw new PostInputError("An event update stays on its event and cannot be moved");
		if (existing.status !== "DRAFT") throw new PostInputError("A published post's placement can't change");
		placement = await resolveContentPlacement(viewer.userId, {
			asPageId: asPageId !== undefined ? asPageId : existing.asPageId,
			pageId: pageId !== undefined ? pageId : existing.pageId,
			showOnAuthorProfile: showOnAuthorProfile !== undefined ? showOnAuthorProfile : existing.showOnAuthorProfile,
		});
	}

	const validation = validatePostUpdateData({ title, content, tags });
	if (!validation.valid) throw new PostInputError(validation.error ?? "Invalid post");

	if (pinnedAt !== undefined) {
		await assertPinChange(viewer.userId, { kind: "post", id, userId: existing.userId, pageId: placement?.pageId ?? existing.pageId }, pinnedAt);
	}

	const updateData: Prisma.PostUncheckedUpdateInput = {};
	// Re-parenting (pageId change) re-derives the post's content visibility from its NEW parent —
	// passing the real eventId so an event-attached post inherits the event's visibility, not the
	// author's profile default. Child update posts cascade to match.
	let reparentedVisibility: ContentVisibility | undefined;
	if (placement) {
		updateData.pageId = placement.pageId;
		updateData.asPageId = placement.asPageId;
		updateData.showOnAuthorProfile = placement.showOnAuthorProfile;
		if (placement.pageId !== existing.pageId) {
			reparentedVisibility = await resolveParentVisibility(existing.userId, placement.pageId, existing.eventId);
			updateData.contentVisibility = reparentedVisibility;
		}
	}
	if (title !== undefined) updateData.title = title?.trim() || null;
	if (content !== undefined) updateData.content = content.trim();
	if (tags !== undefined) updateData.tags = tags.map((tag) => tag.trim()).filter(Boolean);
	if (topics !== undefined) updateData.topics = Array.isArray(topics) ? topics : [];
	if (pinnedAt !== undefined) updateData.pinnedAt = pinnedAt === null ? null : new Date(pinnedAt);
	if (status === "PUBLISHED" || status === "DRAFT") {
		if (status === "PUBLISHED") {
			// Publishable with a title, body, OR at least one photo. Resolve the final text
			// (incoming if set now, else stored); only count photos when there's no text.
			const stored = (title === undefined || content === undefined)
				? await prisma.post.findUnique({ where: { id }, select: { title: true, content: true } })
				: null;
			const finalTitle = title !== undefined ? title : stored?.title ?? null;
			const finalContent = content !== undefined ? content : stored?.content ?? "";
			if (!postHasContent({ title: finalTitle, content: finalContent })) {
				const imageCount = await prisma.imageAttachment.count({ where: { type: AttachmentTarget.POST, targetId: id } });
				if (imageCount === 0) throw new PostInputError("Cannot publish an empty post");
			}
		}
		updateData.status = status;
	}

	await prisma.$transaction(async (tx) => {
		await tx.post.update({ where: { id }, data: updateData });
		if (placement) {
			// Replies copy the parent's placement even when the page stays put, so a
			// draft that switches from "as the page" to "to the page" does not leave
			// replies speaking as the page. Visibility changes only with the audience.
			await tx.post.updateMany({
				where: { parentPostId: id },
				data: { pageId: placement.pageId, asPageId: placement.asPageId, showOnAuthorProfile: placement.showOnAuthorProfile },
			});
			if (reparentedVisibility !== undefined) {
				await syncDescendantVisibility("POST", id, reparentedVisibility, tx);
			}
		}
	});
}

/** Delete a post as the viewer: not viewable → not_found, then moderation rights (author or page manager). */
export async function removePost(viewer: ViewerContext & { userId: string }, id: string): Promise<void> {
	const existing = await requireViewablePost(id, viewer);
	if (!existing) throw new PostInputError("Post not found", "not_found");
	if (!(await canModerateContent(viewer.userId, existing))) {
		throw new PostForbiddenError("You can only delete your own posts");
	}
	await deletePost(id);
}

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
