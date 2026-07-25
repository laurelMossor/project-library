import { NextResponse } from "next/server";
import { getPostsByPage } from "@/lib/utils/server/post";
import { notFound, serverError } from "@/lib/utils/errors";
import { getViewerContext, requireViewableProfile } from "@/lib/utils/server/visibility";

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
		// A LOCKED (PRIVATE-profile) page hides its collection from non-edge viewers just like the
		// SSR stub — the JSON collection must not serve what the page view withholds (finding 7).
		if (!(await requireViewableProfile("PAGE", pageId, viewer))) {
			return notFound("Page not found");
		}
		const posts = await getPostsByPage(pageId, { viewer });
		return NextResponse.json(posts);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/posts error:", error);
		return serverError("Failed to fetch posts");
	}
}
