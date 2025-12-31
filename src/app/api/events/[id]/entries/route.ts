import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEventById } from "@/lib/utils/server/event";
import { getAllEntries, createEntry } from "@/lib/utils/server/entry";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { prisma } from "@/lib/utils/server/prisma";
import { COLLECTION_TYPES } from "@/lib/types/collection";

// GET /api/events/[id]/entries - Get all entries for an event
// Public endpoint (anyone can view event entries)
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

		const entries = await getAllEntries(id, COLLECTION_TYPES.EVENT);
		return NextResponse.json(entries);
	} catch (error) {
		console.error("Error fetching entries:", error);
		return serverError("Failed to fetch entries");
	}
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const { id } = await params;

	try {
		// Verify event exists and user owns it
		const event = await prisma.event.findUnique({
			where: { id },
			select: { id: true, ownerId: true },
		});

		if (!event) {
			return notFound("Event not found");
		}

		if (event.ownerId !== session.user.id) {
			return NextResponse.json(
				{ error: "Only the event owner can create entries" },
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

		const entry = await createEntry(id, "event", {
			title: title?.trim() || undefined,
			content: content.trim(),
		});

		return NextResponse.json(entry, { status: 201 });
	} catch (error) {
		console.error("Error creating entry:", error);
		if (error instanceof Error && error.message === "Collection not found") {
			return notFound(error.message);
		}
		return serverError("Failed to create entry");
	}
}

