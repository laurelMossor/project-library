import { NextResponse } from "next/server";
import { getPostUpdates } from "@/lib/utils/server/post";
import { getViewerContext, requireViewablePost } from "@/lib/utils/server/visibility";
import { notFound, serverError } from "@/lib/utils/errors";

// GET /api/posts/[id]/posts — updates under a post.
// The parent is gated first (missing or not viewable → 404). getPostUpdates then
// hides DRAFT children from non-owners and PRIVATE children from viewers who
// cannot see the parent privately.
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	try {
		const viewer = await getViewerContext();
		const post = await requireViewablePost(id, viewer);
		if (!post) {
			return notFound("Post not found");
		}

		const posts = await getPostUpdates(id, viewer);
		return NextResponse.json(posts);
	} catch (error) {
		console.error("Error fetching post updates:", error);
		return serverError("Failed to fetch posts");
	}
}
