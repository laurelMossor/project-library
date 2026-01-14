import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEventById } from "@/lib/utils/server/event";
import { getPostsForEvent, createPost } from "@/lib/utils/server/post";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { getActorIdForUser, actorOwnsEvent } from "@/lib/utils/server/actor";

// GET /api/events/[id]/posts - Get all posts for an event
// Public endpoint (anyone can view event posts)
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	try {
		// Verify event exists
		const event = await getEventById(id);
		if (!event) {
			return notFound("Event not found");
		}

		const posts = await getPostsForEvent(id);
		return NextResponse.json(posts);
	} catch (error) {
		console.error("Error fetching posts:", error);
		return serverError("Failed to fetch posts");
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const { id } = await params;

	try {
		// Verify event exists and user owns it (via Actor)
		const event = await getEventById(id);
		if (!event) {
			return notFound("Event not found");
		}

		const actorId = await getActorIdForUser(session.user.id);
		if (!actorId || !(await actorOwnsEvent(actorId, id))) {
			return NextResponse.json(
				{ error: "Only the event owner can create posts" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const { title, content } = data;

		// Validate content is provided
		if (!content || typeof content !== "string" || content.trim().length === 0) {
			return badRequest("Content is required and cannot be empty");
		}

		// Validate title if provided
		if (title !== undefined && title !== null && typeof title !== "string") {
			return badRequest("Title must be a string");
		}

		const post = await createPost(session.user.id, {
			eventId: id,
			title: title?.trim() || null,
			content: content.trim(),
		});

		return NextResponse.json(post, { status: 201 });
	} catch (error) {
		console.error("Error creating post:", error);
		if (error instanceof Error && error.message === "Event not found") {
			return notFound(error.message);
		}
		return serverError("Failed to create post");
	}
}

