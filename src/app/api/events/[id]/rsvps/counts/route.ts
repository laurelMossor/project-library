import { NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/utils/errors";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { getRsvpCounts } from "@/lib/utils/server/rsvp";
import { getViewerContext, requireViewableEvent } from "@/lib/utils/server/visibility";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/events/:id/rsvps/counts
 * Get RSVP count summary (public endpoint)
 */
export async function GET(request: Request, { params }: Params) {
	const limited = await enforceRateLimit(request, "rsvp-counts", {
		maxRequests: 60,
		windowMs: 60 * 1000,
	});
	if (limited) return limited;

	try {
		const { id } = await params;

		// One gate: a viewer who can't see the event (missing / PRIVATE / others' draft) 404s, so
		// the count can't be used as an existence or size oracle.
		const viewer = await getViewerContext();
		const event = await requireViewableEvent(id, viewer);
		if (!event) {
			return notFound("Event not found");
		}

		const counts = await getRsvpCounts(id);
		return NextResponse.json(counts);
	} catch (error) {
		console.error("GET /api/events/:id/rsvps/counts error:", error);
		return serverError("Failed to fetch RSVP counts");
	}
}
