import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { notFound, serverError } from "@/lib/utils/errors";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { getRsvpCounts } from "@/lib/utils/server/rsvp";
import { getViewerContext, canViewEvent } from "@/lib/utils/server/visibility";

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

		// Verify event exists AND is viewable + published — otherwise 404 (no existence/size oracle).
		const [event, viewer] = await Promise.all([
			prisma.event.findUnique({
				where: { id },
				select: { id: true, userId: true, pageId: true, visibility: true, status: true },
			}),
			getViewerContext(),
		]);

		if (!event) {
			return notFound("Event not found");
		}
		const isOwner = viewer.userId === event.userId;
		if ((event.status === "DRAFT" && !isOwner) || !(await canViewEvent(event, viewer))) {
			return notFound("Event not found");
		}

		const counts = await getRsvpCounts(id);
		return NextResponse.json(counts);
	} catch (error) {
		console.error("GET /api/events/:id/rsvps/counts error:", error);
		return serverError("Failed to fetch RSVP counts");
	}
}
