import { NextResponse } from "next/server";
import { getPostsByPage } from "@/lib/utils/server/post";
import { serverError } from "@/lib/utils/errors";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/posts
 * List top-level published posts for a page
 * Public endpoint
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const posts = await getPostsByPage(pageId);
		return NextResponse.json(posts);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/posts error:", error);
		return serverError("Failed to fetch posts");
	}
}
