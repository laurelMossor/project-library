import { NextResponse } from "next/server";
import { getPostsByPage } from "@/lib/utils/server/post";
import { serverError } from "@/lib/utils/errors";
import { getViewerContext } from "@/lib/utils/server/visibility";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/posts
 * List top-level published posts for a page
 * Public endpoint — members/followers also see UNLISTED/PRIVATE via viewer.
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const viewer = await getViewerContext();
		const posts = await getPostsByPage(pageId, { viewer });
		return NextResponse.json(posts);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/posts error:", error);
		return serverError("Failed to fetch posts");
	}
}
