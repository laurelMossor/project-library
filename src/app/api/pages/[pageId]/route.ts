import { NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/utils/errors";
import { getPageById } from "@/lib/utils/server/page";
import { getViewerContext, canViewProfile } from "@/lib/utils/server/visibility";

type RouteParams = { params: Promise<{ pageId: string }> };

export const maxDuration = 60;

/**
 * GET /api/pages/[pageId]
 * Get a page by ID
 * Public endpoint
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const [page, viewer] = await Promise.all([getPageById(pageId), getViewerContext()]);

		if (!page) {
			return notFound("Page not found");
		}

		// Visibility gate: PRIVATE pages are 404 for non-members/non-followers
		if (!(await canViewProfile("PAGE", page, viewer))) {
			return notFound("Page not found");
		}

		return NextResponse.json(page);
	} catch (error) {
		console.error("GET /api/pages/[pageId] error:", error);
		return serverError("Failed to fetch page");
	}
}
