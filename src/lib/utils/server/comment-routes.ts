// ⚠️ SERVER-ONLY: Shared handlers for the comment collection routes.
//
// posts/[id]/comments and events/[id]/comments differ only in which parent they gate and
// which id the comment hangs off — so the request logic lives here once, parameterized by
// `kind`, and the two route files stay thin dispatchers. 404-before-403 discipline
// (VISIBILITY_RULES §7) is enforced here for both.
import { NextResponse } from "next/server";
import { getViewerContext, requireViewablePost, requireViewableEvent, type ViewerContext } from "./visibility";
import { getPostComments, getEventComments, createComment, CommentInputError } from "./comment";
import { canPostAsPage } from "./permission";
import { validateCommentContent } from "@/lib/validations";
import { enforceRateLimit } from "./rate-limit";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";

type ParentKind = "post" | "event";

const parentLabel = (kind: ParentKind) => (kind === "post" ? "Post not found" : "Event not found");

function requireViewableParent(kind: ParentKind, id: string, viewer: ViewerContext) {
	return kind === "post" ? requireViewablePost(id, viewer) : requireViewableEvent(id, viewer);
}

/** GET — list a post/event's comments. Inherits the parent's viewability (gate → 404). */
export async function handleListComments(kind: ParentKind, id: string) {
	try {
		const viewer = await getViewerContext();
		const parent = await requireViewableParent(kind, id, viewer);
		if (!parent) {
			return notFound(parentLabel(kind));
		}
		const comments = kind === "post" ? await getPostComments(id) : await getEventComments(id);
		return NextResponse.json(comments);
	} catch (error) {
		console.error("Error fetching comments:", error);
		return serverError("Failed to fetch comments");
	}
}

/** POST — add a comment (auth required; may comment "as" a managed page). */
export async function handleCreateComment(kind: ParentKind, request: Request, id: string) {
	const viewer = await getViewerContext();
	if (!viewer.userId) {
		return unauthorized();
	}

	const limited = await enforceRateLimit(request, "comment-create", {
		maxRequests: 20,
		windowMs: 60 * 1000,
	});
	if (limited) return limited;

	try {
		// Gate viewability BEFORE revealing anything: a viewer who can't see the parent 404s.
		const parent = await requireViewableParent(kind, id, viewer);
		if (!parent) {
			return notFound(parentLabel(kind));
		}

		const data = await request.json();
		const { content, asPageId } = data;

		const validation = validateCommentContent(content);
		if (!validation.valid) {
			return badRequest(validation.error!);
		}

		if (asPageId !== undefined && asPageId !== null && typeof asPageId !== "string") {
			return badRequest("asPageId must be a string");
		}

		// Commenting "as" a page requires ADMIN/EDITOR — verified from the session, never the
		// client. 403 (not 404) since the parent itself is viewable here.
		if (asPageId && !(await canPostAsPage(viewer.userId, asPageId))) {
			return NextResponse.json(
				{ error: "You don't have permission to comment as this page" },
				{ status: 403 }
			);
		}

		const target = kind === "post" ? { postId: id } : { eventId: id };
		const comment = await createComment(viewer.userId, { ...target, asPageId: asPageId || null, content });
		return NextResponse.json(comment, { status: 201 });
	} catch (error) {
		if (error instanceof CommentInputError) {
			return badRequest(error.message);
		}
		console.error("Error creating comment:", error);
		return serverError("Failed to create comment");
	}
}
