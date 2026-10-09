"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { addComment, editComment, removeComment } from "@/lib/utils/server/comment";
import { viewerContextFor } from "@/lib/utils/server/visibility";
import type { CommentTarget } from "@/lib/types/comment";

// The comment list is server-rendered on the post/event page, so the wrapper's refresh
// is what puts a new, edited, or deleted comment on screen.

const MUTATE_LIMIT = { key: "comment-mutate", maxRequests: 30, windowMs: 60 * 1000 };

/** Comment on a post or event, optionally as a page you manage. */
export const addCommentAction = authedAction(
	async (ctx, input: { parent: CommentTarget; content: string; asPageId?: string | null }) => {
		const kind = input?.parent?.kind;
		if (kind !== "post" && kind !== "event") throw new DomainError("Invalid comment target");
		await addComment(await viewerContextFor(ctx.userId), { kind, id: requireId(input.parent.id, kind) }, input);
	},
	{ rateLimit: { key: "comment-create", maxRequests: 20, windowMs: 60 * 1000 } },
);

/** Edit your own comment. */
export const editCommentAction = authedAction(
	async (ctx, input: { id: string; content: string }) => {
		await editComment(await viewerContextFor(ctx.userId), requireId(input?.id, "comment"), input.content);
	},
	{ rateLimit: MUTATE_LIMIT },
);

/** Delete a comment (author, content owner, or page manager). */
export const deleteCommentAction = authedAction(
	async (ctx, input: { id: string }) => {
		await removeComment(await viewerContextFor(ctx.userId), requireId(input?.id, "comment"));
	},
	{ rateLimit: MUTATE_LIMIT },
);
