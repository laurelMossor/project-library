import { NextResponse } from "next/server";
import { getPageFollowing } from "@/lib/utils/server/follow";
import { notFound, serverError } from "@/lib/utils/errors";
import { getViewerContext, requireViewableProfile } from "@/lib/utils/server/visibility";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ pageId: string }> }
) {
	try {
		const { pageId } = await params;
		const viewer = await getViewerContext();
		if (!(await requireViewableProfile("PAGE", pageId, viewer))) {
			return notFound("Page not found");
		}
		const following = await getPageFollowing(pageId);
		return NextResponse.json({ following });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/following error:", error);
		return serverError("Failed to fetch following");
	}
}
