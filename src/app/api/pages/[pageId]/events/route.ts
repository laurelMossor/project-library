import { NextResponse } from "next/server";
import { getEventsByPage } from "@/lib/utils/server/event";
import { serverError } from "@/lib/utils/errors";
import { getViewerContext } from "@/lib/utils/server/visibility";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/events
 * List events for a page
 * Public endpoint — members/followers also see UNLISTED/PRIVATE via viewer.
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const viewer = await getViewerContext();
		const events = await getEventsByPage(pageId, { viewer });
		return NextResponse.json(events);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/events error:", error);
		return serverError("Failed to fetch events");
	}
}
