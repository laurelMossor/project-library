// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { commentWithAuthorFields, type CommentFromQuery } from "./fields";
import { canModerateContent, canPostAsPage } from "./permission";
import type { ViewerContext } from "./visibility";
import { emitActivity, type EntityRef, type ObjectRef } from "./activity";
import { getMentionedIdentities } from "./notification";
import { NotificationObject } from "@prisma/client";
import type { CommentItem } from "@/lib/types/comment";
import { extractMentionHandles, MAX_MENTION_NOTIFICATIONS } from "@/lib/utils/mentions";

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

	// The object is the post/event (plus this comment, so the bell row scrolls to it).
	const actor = commentActor(userId, data.asPageId ?? null);
	const object: ObjectRef = data.postId
		? { type: NotificationObject.POST, id: data.postId, commentId: comment.id }
		: { type: NotificationObject.EVENT, id: data.eventId!, commentId: comment.id };

	const mentions = await resolveMentions(extractMentionHandles(comment.content));
	const tagged = await notifyMentions(userId, actor, object, mentions, MAX_MENTION_NOTIFICATIONS);

	// Notify the content owner that someone commented — unless they're commenting on their own content
	// (actor == target), or the comment tags them (the more specific tag notification already went out).
	const ownerRef: EntityRef = owner.asPageId
		? { type: "PAGE", id: owner.asPageId }
		: { type: "USER", id: owner.userId };
	if (!sameEntity(actor, ownerRef) && !tagged.some((t) => sameEntity(t, ownerRef))) {
		await emitActivity("comment.created", actor, ownerRef, object, { authorUserId: userId });
	}

	return toCommentItem(comment, new Set(mentions.map((m) => m.handle)));
}

// ---------------------------------------------------------------------------
// @-mentions — resolved from the text on every read and write (nothing extra is stored), so a handle
// is bold exactly when it names a real user or page right now.
// ---------------------------------------------------------------------------

/** A mentioned handle that resolved to a user or page. */
type MentionTarget = EntityRef & { handle: string };

const sameEntity = (a: EntityRef, b: EntityRef) => a.type === b.type && a.id === b.id;

/** Who a comment speaks as: the page when commenting "as" one, else the author. */
function commentActor(authorId: string, asPageId: string | null): EntityRef {
	return asPageId ? { type: "PAGE", id: asPageId } : { type: "USER", id: authorId };
}

/**
 * Resolve lowercase handles to the users/pages that hold them (one query), in the order the handles
 * were given — i.e. the order they appear in the text, so a cap keeps the first people named.
 * Unknown handles drop out.
 */
async function resolveMentions(handles: string[]): Promise<MentionTarget[]> {
	if (handles.length === 0) return [];
	const rows = await prisma.handle.findMany({
		where: { handle: { in: handles } },
		select: { handle: true, userId: true, pageId: true },
	});
	const byHandle = new Map(rows.map((r) => [r.handle, r]));
	return handles.flatMap((handle): MentionTarget[] => {
		const r = byHandle.get(handle);
		if (r?.userId) return [{ type: "USER", id: r.userId, handle }];
		if (r?.pageId) return [{ type: "PAGE", id: r.pageId, handle }];
		return [];
	});
}

/**
 * Send "tagged you in a comment" to up to `limit` mentioned identities — never the speaker, and never
 * the human who wrote it (commenting as a page and tagging your own handle tells no one). Recipients who
 * can't see the post/event are dropped by the dispatcher's visibility gate. Returns who was tagged.
 */
async function notifyMentions(
	authorUserId: string,
	actor: EntityRef,
	object: ObjectRef,
	mentions: MentionTarget[],
	limit: number,
): Promise<MentionTarget[]> {
	const targets = mentions
		.filter((m) => !sameEntity(m, actor) && !(m.type === "USER" && m.id === authorUserId))
		.slice(0, Math.max(0, limit));
	await Promise.all(
		targets.map((t) => emitActivity("comment.mentioned", actor, { type: t.type, id: t.id }, object, { authorUserId })),
	);
	return targets;
}

/** Comment rows → CommentItems, with each one's resolved mentions (one handle query for the whole list). */
async function toCommentItems(rows: CommentFromQuery[]): Promise<CommentItem[]> {
	const handles = [...new Set(rows.flatMap((r) => (r.deletedAs ? [] : extractMentionHandles(r.content))))];
	const known = new Set((await resolveMentions(handles)).map((m) => m.handle));
	return rows.map((r) => toCommentItem(r, known));
}

/** List a post's comments, oldest first (the thread reads top to bottom). Comments inherit the parent's viewability (gated by the route). */
export async function getPostComments(postId: string): Promise<CommentItem[]> {
	const comments = await prisma.comment.findMany({
		where: { postId },
		orderBy: { createdAt: "asc" },
		select: commentWithAuthorFields,
	});
	return toCommentItems(comments);
}

/** List an event's comments, oldest first. */
export async function getEventComments(eventId: string): Promise<CommentItem[]> {
	const comments = await prisma.comment.findMany({
		where: { eventId },
		orderBy: { createdAt: "asc" },
		select: commentWithAuthorFields,
	});
	return toCommentItems(comments);
}

/**
 * Minimal comment shape for gating a mutation: its parent target, its author, and the identity it
 * speaks as (an edit re-checks that identity and tags in its name).
 */
export async function getCommentForModeration(id: string) {
	return prisma.comment.findUnique({
		where: { id },
		select: { id: true, authorId: true, asPageId: true, postId: true, eventId: true },
	});
}

type CommentForEdit = NonNullable<Awaited<ReturnType<typeof getCommentForModeration>>>;

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
 * this is the write. Content is trimmed; validation happens in the route. Anyone tagged in the new
 * text who hasn't already been told about this comment gets a tag notification — checked against the
 * stored notifications, so removing and re-adding a handle never re-notifies. The comment's lifetime
 * total stays within MAX_MENTION_NOTIFICATIONS.
 */
export async function updateComment(comment: CommentForEdit, content: string): Promise<CommentItem> {
	const updated = await prisma.comment.update({
		where: { id: comment.id },
		data: { content: content.trim() },
		select: commentWithAuthorFields,
	});

	const mentions = await resolveMentions(extractMentionHandles(updated.content));
	if (mentions.length > 0 && comment.authorId) {
		const already = await getMentionedIdentities(comment.id);
		const fresh = mentions.filter((m) => !already.some((a) => sameEntity(a, m)));
		const object: ObjectRef = comment.postId
			? { type: NotificationObject.POST, id: comment.postId, commentId: comment.id }
			: { type: NotificationObject.EVENT, id: comment.eventId!, commentId: comment.id };
		const actor = commentActor(comment.authorId, comment.asPageId);
		await notifyMentions(comment.authorId, actor, object, fresh, MAX_MENTION_NOTIFICATIONS - already.length);
	}

	return toCommentItem(updated, new Set(mentions.map((m) => m.handle)));
}

/** `known` =the handles (lowercase) that resolved; the client bolds only these. */
function toCommentItem(row: CommentFromQuery, known: ReadonlySet<string>): CommentItem {
	const { deletedAs, ...rest } = row;
	const mentions = deletedAs ? [] : extractMentionHandles(row.content).filter((h) => known.has(h));
	return { ...rest, deleted: deletedAs, mentions };
}
