import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteEvent, getEventById, updateEvent } from "@/lib/utils/server/event";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";
import { validateEventUpdateData } from "@/lib/validations";
import type { EventUpdateInput } from "@/lib/types/event";

function parseNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	try {
		const event = await getEventById(id);

		if (!event) {
			return notFound("Event not found");
		}

		return NextResponse.json(event);
	} catch (error) {
		console.error("Error fetching event:", error);
		return notFound("Event not found");
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const event = await getEventById(id);
	if (!event) {
		return notFound("Event not found");
	}

	if (event.owner.id !== session.user.id) {
		return unauthorized("Only the owner can update this event");
	}

	const data = await request.json();

	const updatePayload: EventUpdateInput = {};

	if (data.title !== undefined) {
		if (typeof data.title !== "string") {
			return badRequest("Invalid title");
		}
		updatePayload.title = data.title.trim();
	}

	if (data.description !== undefined) {
		if (typeof data.description !== "string") {
			return badRequest("Invalid description");
		}
		updatePayload.description = data.description.trim();
	}

	if (data.dateTime !== undefined) {
		const parsedDate = new Date(data.dateTime);
		if (Number.isNaN(parsedDate.getTime())) {
			return badRequest("Invalid date");
		}
		updatePayload.dateTime = parsedDate;
	}

	if (data.location !== undefined) {
		if (typeof data.location !== "string") {
			return badRequest("Invalid location");
		}
		updatePayload.location = data.location.trim();
	}

	if (Object.prototype.hasOwnProperty.call(data, "latitude")) {
		if (data.latitude === null) {
			updatePayload.latitude = null;
		} else {
			const parsed = parseNumber(data.latitude);
			if (parsed === null) {
				return badRequest("Invalid latitude");
			}
			updatePayload.latitude = parsed;
		}
	}

	if (Object.prototype.hasOwnProperty.call(data, "longitude")) {
		if (data.longitude === null) {
			updatePayload.longitude = null;
		} else {
			const parsed = parseNumber(data.longitude);
			if (parsed === null) {
				return badRequest("Invalid longitude");
			}
			updatePayload.longitude = parsed;
		}
	}

	if (data.tags !== undefined) {
		if (!Array.isArray(data.tags)) {
			return badRequest("Tags must be an array");
		}
		const tags = data.tags
			.map((tag: unknown) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
			.filter((tag: string) => tag.length > 0);
		updatePayload.tags = tags;
	}

	// Note: Images should be managed separately via image API endpoints

	if (Object.keys(updatePayload).length === 0) {
		return badRequest("No changes provided");
	}

	const validation = validateEventUpdateData(updatePayload);

	if (!validation.valid) {
		return badRequest(validation.error || "Invalid event update data");
	}

	try {
		const updatedEvent = await updateEvent(id, updatePayload);
		return NextResponse.json(updatedEvent);
	} catch (error) {
		console.error("Error updating event:", error);
		return badRequest("Failed to update event");
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const event = await getEventById(id);
	if (!event) {
		return notFound("Event not found");
	}

	if (event.owner.id !== session.user.id) {
		return unauthorized("Only the owner can delete this event");
	}

	try {
		await deleteEvent(id);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting event:", error);
		return badRequest("Failed to delete event");
	}
}

