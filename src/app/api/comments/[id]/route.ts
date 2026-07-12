import { NextResponse } from "next/server";
import { getViewerContext, requireViewablePost, requireViewableEvent } from "@/lib/utils/server/visibility";
import { getCommentForModeration, canModerateComment, canEditComment, deleteComment, updateComment } from "@/lib/utils/server/comment";
import { validateCommentContent } from "@/lib/validations";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";

/** Resolve a comment's already-gated parent, or null (missing/unviewable). */
async function viewableParent(comment: { postId: string | null; eventId: string | null }, viewer: Awaited<ReturnType<typeof getViewerContext>>) {
	if (comment.postId) return requireViewablePost(comment.postId, viewer);
	if (comment.eventId) return requireViewableEvent(comment.eventId, viewer);
	return null;
}

// DELETE /api/comments/[id] — remove a comment.
// Gate the parent's viewability first (→ 404, so a hidden parent can't be probed), then
// authorize the delete (→ 403 for a viewable comment the caller may not moderate).
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	const viewer = await getViewerContext();
	if (!viewer.userId) {
		return unauthorized();
	}

	try {
		const comment = await getCommentForModeration(id);
		if (!comment) {
			return notFound("Comment not found");
		}

		const parent = await viewableParent(comment, viewer);
		if (!parent) {
			return notFound("Comment not found");
		}

		if (!(await canModerateComment(comment, parent, viewer))) {
			return NextResponse.json(
				{ error: "You don't have permission to delete this comment" },
				{ status: 403 }
			);
		}

		await deleteComment(id);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting comment:", error);
		return serverError("Failed to delete comment");
	}
}

// PATCH /api/comments/[id] — edit a comment's body. Author-only: a content owner may delete
// a comment (moderation) but not rewrite someone else's words. 404-before-403 as with DELETE.
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	const viewer = await getViewerContext();
	if (!viewer.userId) {
		return unauthorized();
	}

	try {
		const comment = await getCommentForModeration(id);
		if (!comment) {
			return notFound("Comment not found");
		}

		const parent = await viewableParent(comment, viewer);
		if (!parent) {
			return notFound("Comment not found");
		}

		if (!canEditComment(comment, viewer)) {
			return NextResponse.json(
				{ error: "You can only edit your own comment" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const validation = validateCommentContent(data?.content);
		if (!validation.valid) {
			return badRequest(validation.error!);
		}

		const updated = await updateComment(id, data.content);
		return NextResponse.json(updated);
	} catch (error) {
		console.error("Error editing comment:", error);
		return serverError("Failed to edit comment");
	}
}
