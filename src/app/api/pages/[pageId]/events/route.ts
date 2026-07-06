import { NextResponse } from "next/server";
import { getEventsByPage } from "@/lib/utils/server/event";
import { notFound, serverError } from "@/lib/utils/errors";
import { getViewerContext, requireViewableProfile } from "@/lib/utils/server/visibility";

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
		// A LOCKED (PRIVATE-profile) page hides its collection from non-edge viewers just like the
		// SSR stub — the JSON collection must not serve what the page view withholds (finding 7).
		if (!(await requireViewableProfile("PAGE", pageId, viewer))) {
			return notFound("Page not found");
		}
		const events = await getEventsByPage(pageId, { viewer });
		return NextResponse.json(events);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/events error:", error);
		return serverError("Failed to fetch events");
	}
}
