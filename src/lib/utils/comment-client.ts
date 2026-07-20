import type { CommentItem, CommentCreateInput } from "../types/comment";
import { API_POST_COMMENTS, API_EVENT_COMMENTS, API_COMMENT } from "../const/routes";
import { authFetch } from "./auth-client";

/** What a comment hangs off — a post or an event. */
export type CommentTarget = { kind: "post" | "event"; id: string };

function commentsEndpoint(target: CommentTarget): string {
	return target.kind === "post" ? API_POST_COMMENTS(target.id) : API_EVENT_COMMENTS(target.id);
}

/** Fetch a post/event's comments (newest first). Public read — inherits the parent's viewability. */
export async function getComments(target: CommentTarget): Promise<CommentItem[]> {
	const res = await fetch(commentsEndpoint(target));
	if (!res.ok) {
		throw new Error(`Failed to fetch comments: ${res.statusText}`);
	}
	return res.json();
}

/** Add a comment. Pass `asPageId` to comment "as" a page you manage. */
export async function createComment(target: CommentTarget, input: CommentCreateInput): Promise<CommentItem> {
	const res = await authFetch(commentsEndpoint(target), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to add comment");
	}
	return res.json();
}

/** Edit your own comment's body. */
export async function updateComment(id: string, content: string): Promise<CommentItem> {
	const res = await authFetch(API_COMMENT(id), {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content }),
	});
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to edit comment");
	}
	return res.json();
}

/** Delete a comment (author or content owner). */
export async function deleteComment(id: string): Promise<void> {
	const res = await authFetch(API_COMMENT(id), { method: "DELETE" });
	if (!res.ok) {
		const errorData = await res.json().catch(() => ({}));
		throw new Error(errorData.error || "Failed to delete comment");
	}
}
