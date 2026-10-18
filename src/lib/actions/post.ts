"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import { DomainError } from "@/lib/utils/server/domain-error";
import { createPost, removePost, updatePost } from "@/lib/utils/server/post";
import type { PostUpdateData } from "@/lib/types/post";
import { viewerContextFor } from "@/lib/utils/server/visibility";
import { logAction } from "@/lib/utils/server/log";

/**
 * Start an empty draft — the /posts/new entry point. Returns its id. Optionally speaking as a
 * page (asPageId) or, in your own voice, placed on a page (pageId); createPost checks both.
 */
export const createDraftPostAction = authedAction(
	async (ctx, input: { asPageId?: string | null; pageId?: string | null }): Promise<string> => {
		const asPageId = typeof input?.asPageId === "string" ? input.asPageId : null;
		const pageId = typeof input?.pageId === "string" ? input.pageId : null;
		const post = await createPost(ctx.userId, { content: "", asPageId, pageId, isDraft: true });
		logAction("post.created", ctx.userId, { postId: post.id, pageId: post.pageId ?? undefined, isReply: false });
		return post.id;
	},
	// The caller navigates to the new draft, so there is nothing on screen to refresh.
	{ refresh: false },
);

/** Edit, publish, re-place, or pin a post. */
export const updatePostAction = authedAction(
	async (ctx, input: { id: string; data: PostUpdateData }) => {
		if (!input?.data || typeof input.data !== "object") throw new DomainError("Invalid post update");
		await updatePost(await viewerContextFor(ctx.userId), requireId(input.id, "post"), input.data);
	},
);

/**
 * Delete a post (author, or a manager of the page it lives on). No refresh: the caller
 * navigates away, and refreshing the deleted post's own page would render a 404 first.
 */
export const deletePostAction = authedAction(
	async (ctx, input: { id: string }) => {
		await removePost(await viewerContextFor(ctx.userId), requireId(input?.id, "post"));
	},
	{ refresh: false },
);
