// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { commentWithAuthorFields, type CommentFromQuery } from "./fields";
import { canModerateContent, canPostAsPage } from "./permission";
import type { ViewerContext } from "./visibility";
import { emitActivity, type EntityRef, type ObjectRef } from "./activity";
import { NotificationObject } from "@prisma/client";
import type { CommentItem } from "@/lib/types/comment";

/**
 * Thrown for caller/client-fixable problems (missing target, missing permission,
 * invariant violations). Routes map this to a 400; anything else is a 500.
 */
export class CommentInputError extends Error {}

type CreateCommentData = {
	postId?: string | null;
	eventId?: string | null;
	asPageId?: string | null;
	content: string;
};

type ContentOwner = { userId: string; pageId: string | null; asPageId: string | null };

/** Fetch the owning identity of the parent post/event (for moderation + the activity target). */
async function getContentOwner(postId: string | null, eventId: string | null): Promise<ContentOwner | null> {
	if (postId) return prisma.post.findUnique({ where: { id: postId }, select: { userId: true, pageId: true, asPageId: true } });
	if (eventId) return prisma.event.findUnique({ where: { id: eventId }, select: { userId: true, pageId: true, asPageId: true } });
	return null;
}

/**
 * Create a comment — the single guarded write path. Enforces the invariants at the choke
 * point: exactly one of postId/eventId (also a DB CHECK), non-empty content, and — when
 * commenting "as" a page — ADMIN/EDITOR on that page. Read-gating of the parent is the
 * route's job (requireViewablePost/Event); this trusts that it already passed.
 */
export async function createComment(userId: string, data: CreateCommentData): Promise<CommentItem> {
	const hasPost = Boolean(data.postId);
	const hasEvent = Boolean(data.eventId);
	if (hasPost === hasEvent) {
		throw new CommentInputError("A comment must target exactly one of a post or an event");
	}
	if (!data.content || data.content.trim().length === 0) {
		throw new CommentInputError("Comment cannot be empty");
	}
	if (data.asPageId && !(await canPostAsPage(userId, data.asPageId))) {
		throw new CommentInputError("You don't have permission to comment as this page");
	}

	const owner = await getContentOwner(data.postId ?? null, data.eventId ?? null);
	if (!owner) {
		throw new CommentInputError("The post or event no longer exists");
	}

	const comment = await prisma.comment.create({
		data: {
			authorId: userId,
			asPageId: data.asPageId || null,
			postId: data.postId || null,
			eventId: data.eventId || null,
			content: data.content.trim(),
		},
		select: commentWithAuthorFields,
	});

	// Notify the content owner that someone commented — unless they're commenting on their own
	// content (actor == target), which needs no self-notification. The object is the post/event so
	// the bell row deep-links to it.
	const actor: EntityRef = data.asPageId ? { type: "PAGE", id: data.asPageId } : { type: "USER", id: userId };
	const target: EntityRef = owner.asPageId
		? { type: "PAGE", id: owner.asPageId }
		: { type: "USER", id: owner.userId };
	if (actor.type !== target.type || actor.id !== target.id) {
		const object: ObjectRef = data.postId
			? { type: NotificationObject.POST, id: data.postId }
			: { type: NotificationObject.EVENT, id: data.eventId! };
		await emitActivity("comment.created", actor, target, object);
	}

	return toCommentItem(comment);
}

/** List a post's comments, newest first. Comments inherit the parent's viewability (gated by the route). */
export async function getPostComments(postId: string): Promise<CommentItem[]> {
	const comments = await prisma.comment.findMany({
		where: { postId },
		orderBy: { createdAt: "desc" },
		select: commentWithAuthorFields,
	});
	return comments.map(toCommentItem);
}

/** List an event's comments, newest first. */
export async function getEventComments(eventId: string): Promise<CommentItem[]> {
	const comments = await prisma.comment.findMany({
		where: { eventId },
		orderBy: { createdAt: "desc" },
		select: commentWithAuthorFields,
	});
	return comments.map(toCommentItem);
}

/** Minimal comment shape for gating a mutation: its parent target + its author. */
export async function getCommentForModeration(id: string) {
	return prisma.comment.findUnique({
		where: { id },
		select: { id: true, authorId: true, postId: true, eventId: true },
	});
}

/**
 * May `viewer` delete this comment? The comment author, the content owner, or a
 * manager (ADMIN/EDITOR) of the owning page. `parent` is the already-gated
 * post/event (its userId/pageId) returned by requireViewable*.
 */
export async function canModerateComment(
	comment: { authorId: string | null },
	parent: { userId: string; pageId: string | null; asPageId?: string | null },
	viewer: ViewerContext,
): Promise<boolean> {
	if (!viewer.userId) return false;
	if (viewer.userId === comment.authorId) return true;
	return canModerateContent(viewer.userId, parent);
}

/**
 * May `viewer` edit this comment? Author-only — a content owner may *delete* a comment
 * (moderation) but not rewrite someone else's words. Distinct from canModerateComment on purpose.
 */
export function canEditComment(comment: { authorId: string | null }, viewer: ViewerContext): boolean {
	return viewer.userId !== null && comment.authorId !== null && viewer.userId === comment.authorId;
}

/** Delete a comment. Authorization (canModerateComment) is the route's responsibility. */
export async function deleteComment(id: string): Promise<void> {
	await prisma.comment.delete({ where: { id } });
}

/**
 * Edit a comment's body. Authorization (author-only — see the route) is the caller's job;
 * this is the write. Content is trimmed; validation happens in the route.
 */
export async function updateComment(id: string, content: string): Promise<CommentItem> {
	const comment = await prisma.comment.update({
		where: { id },
		data: { content: content.trim() },
		select: commentWithAuthorFields,
	});
	return toCommentItem(comment);
}

function toCommentItem(row: CommentFromQuery): CommentItem {
	const { deletedAs, ...rest } = row;
	return { ...rest, deleted: deletedAs };
}
