import { NextResponse } from "next/server";
import { getPageFollowers } from "@/lib/utils/server/follow";
import { serverError, notFound } from "@/lib/utils/errors";
import { getViewerContext, canViewPage } from "@/lib/utils/server/visibility";
import { getPageById } from "@/lib/utils/server/page";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ pageId: string }> }
) {
	try {
		const { pageId } = await params;
		const [page, viewer] = await Promise.all([getPageById(pageId), getViewerContext()]);

		if (!page) return notFound("Page not found");

		// Followers list of a private page is restricted to members
		if (!(await canViewPage(page, viewer))) {
			return notFound("Page not found");
		}

		const followers = await getPageFollowers(pageId);
		return NextResponse.json({ followers });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/followers error:", error);
		return serverError("Failed to fetch followers");
	}
}
