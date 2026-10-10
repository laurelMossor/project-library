import { NextResponse } from "next/server";
import { getEventUpdates } from "@/lib/utils/server/post";
import { getViewerContext, requireViewableEvent } from "@/lib/utils/server/visibility";
import { notFound, serverError } from "@/lib/utils/errors";

// GET /api/events/[id]/posts - Get all posts for an event
// Public endpoint (anyone can view event posts)
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	try {
		// One gate for existence + DRAFT-owner + content visibility (co-managers of a page-hosted
		// draft pass; strangers 404). getEventUpdates itself also filters DRAFT child posts for
		// non-owners.
		const viewer = await getViewerContext();
		const event = await requireViewableEvent(id, viewer);
		if (!event) {
			return notFound("Event not found");
		}

		const posts = await getEventUpdates(id, viewer);
		return NextResponse.json(posts);
	} catch (error) {
		console.error("Error fetching posts:", error);
		return serverError("Failed to fetch posts");
	}
}
