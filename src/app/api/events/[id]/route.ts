import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateEventUpdateData } from "@/lib/validations";
import { eventWithOwnerFields } from "@/lib/utils/server/fields";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";

type Params = { params: Promise<{ id: string }> };

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

/**
 * GET /api/events/:id
 * Get an event by ID
 * Public endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { id } = await params;

		const event = await prisma.event.findUnique({
			where: { id },
			select: eventWithOwnerFields,
		});

		if (!event) {
			return notFound("Event not found");
		}

		// Load images
		const images = await getImagesForTarget("EVENT", id);

		const eventItem = {
			...event,
			type: COLLECTION_TYPES.EVENT,
			images,
		};

		return NextResponse.json(eventItem);
	} catch (error) {
		console.error("GET /api/events/:id error:", error);
		return serverError("Failed to fetch event");
	}
}

/**
 * PATCH /api/events/:id
 * Update an event (must be owner)
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify event exists and belongs to active owner
		const existing = await prisma.event.findUnique({
			where: { id },
			select: { ownerId: true },
		});

		if (!existing) {
			return notFound("Event not found");
		}

		if (existing.ownerId !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only edit your own events" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const { title, description, eventDateTime, location, latitude, longitude, tags, topics } = data;

		const parsedDateTime = eventDateTime !== undefined ? new Date(eventDateTime) : undefined;
		const parsedLatitude = latitude !== undefined ? parseNumber(latitude) : undefined;
		const parsedLongitude = longitude !== undefined ? parseNumber(longitude) : undefined;

		// Process tags if provided
		let processedTags: string[] | undefined;
		if (tags !== undefined) {
			if (typeof tags === "string") {
				processedTags = tags
					.split(",")
					.map((tag) => tag.trim())
					.filter(Boolean);
			} else if (Array.isArray(tags)) {
				processedTags = tags
					.map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
					.filter(Boolean);
			}
		}

		// Validate update data
		const validation = validateEventUpdateData({
			title,
			description,
			eventDateTime: parsedDateTime,
			location,
			latitude: parsedLatitude ?? undefined,
			longitude: parsedLongitude ?? undefined,
			tags: processedTags,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid event data");
		}

		const updateData: Record<string, unknown> = {};
		if (title !== undefined) updateData.title = title.trim();
		if (description !== undefined) updateData.description = description.trim();
		if (parsedDateTime !== undefined) updateData.eventDateTime = parsedDateTime;
		if (location !== undefined) updateData.location = location.trim();
		if (parsedLatitude !== undefined) updateData.latitude = parsedLatitude;
		if (parsedLongitude !== undefined) updateData.longitude = parsedLongitude;
		if (processedTags !== undefined) updateData.tags = processedTags;
		if (topics !== undefined) updateData.topics = Array.isArray(topics) ? topics : [];

		const event = await prisma.event.update({
			where: { id },
			data: updateData,
			select: eventWithOwnerFields,
		});

		// Load images
		const images = await getImagesForTarget("EVENT", id);

		const eventItem = {
			...event,
			type: COLLECTION_TYPES.EVENT,
			images,
		};

		return NextResponse.json(eventItem);
	} catch (error) {
		console.error("PATCH /api/events/:id error:", error);
		return serverError("Failed to update event");
	}
}

/**
 * DELETE /api/events/:id
 * Delete an event (must be owner)
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify event exists and belongs to active owner
		const existing = await prisma.event.findUnique({
			where: { id },
			select: { ownerId: true },
		});

		if (!existing) {
			return notFound("Event not found");
		}

		if (existing.ownerId !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only delete your own events" },
				{ status: 403 }
			);
		}

		await prisma.event.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/events/:id error:", error);
		return serverError("Failed to delete event");
	}
}
