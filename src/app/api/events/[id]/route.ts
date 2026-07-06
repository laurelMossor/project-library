import { NextResponse } from "next/server";
import { ContentVisibility } from "@prisma/client";
import { prisma } from "@/lib/utils/server/prisma";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateEventUpdateData } from "@/lib/validations";
import { eventWithUserFields } from "@/lib/utils/server/fields";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import { getViewerContext, canViewEvent, isContentOwner, requireViewableEvent, resolveParentVisibility, syncDescendantVisibility } from "@/lib/utils/server/visibility";

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
 * Draft events are only visible to the owner
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { id } = await params;

		const event = await prisma.event.findUnique({
			where: { id },
			select: eventWithUserFields,
		});

		if (!event) {
			return notFound("Event not found");
		}

		const viewer = await getViewerContext();
		// DRAFT events are visible only to their owner (author or a manager of the hosting page);
		// everyone else — and any viewer who can't pass the content gate — gets 404, never an oracle.
		if (event.status === "DRAFT" && !(await isContentOwner(viewer, event))) {
			return notFound("Event not found");
		}
		if (!(await canViewEvent(event, viewer))) {
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
		const { id } = await params;
		const viewer = await getViewerContext();
		if (!viewer.userId) {
			return unauthorized();
		}

		// Gate viewability first: a viewer who can't see the event (missing / PRIVATE / another
		// owner's draft) gets 404 — never a 403 that would confirm the event exists (finding #20).
		const existing = await requireViewableEvent(id, viewer);
		if (!existing) {
			return notFound("Event not found");
		}
		// Viewable but not the author → 403. Editing stays author-only.
		if (existing.userId !== viewer.userId) {
			return NextResponse.json(
				{ error: "You can only edit your own events" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		// `visibility` is intentionally NOT accepted here — content visibility is
		// derived from the owning profile's contentVisibility, never client-set.
		const { title, content, eventDateTime, eventTimezone, location, latitude, longitude, tags, topics, status, pinnedAt, pageId } = data;

		// If switching host page (to a page, not clearing it), verify permission
		if (pageId != null) {
			const allowed = await canPostAsPage(viewer.userId, pageId);
			if (!allowed) {
				return NextResponse.json({ error: "You don't have permission to host this event as that page" }, { status: 403 });
			}
		}

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
			content,
			eventDateTime: parsedDateTime,
			location,
			latitude: parsedLatitude ?? undefined,
			longitude: parsedLongitude ?? undefined,
			tags: processedTags,
			status,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid event data");
		}

		const updateData: Record<string, unknown> = {};
		// Re-parenting (host page change) re-derives the event's content visibility from the new
		// owner and cascades to its child posts, so a private-page event can't retain a broader
		// visibility than its new parent allows (findings 2/3). Never client-set.
		let reparentedVisibility: ContentVisibility | undefined;
		if (pageId !== undefined) {
			updateData.pageId = pageId;
			if ((pageId || null) !== existing.pageId) {
				reparentedVisibility = await resolveParentVisibility(existing.userId, pageId || null, null);
				updateData.contentVisibility = reparentedVisibility;
			}
		}
		if (title !== undefined) updateData.title = title.trim();
		if (content !== undefined) updateData.content = content.trim();
		if (parsedDateTime !== undefined) updateData.eventDateTime = parsedDateTime;
		if (eventTimezone !== undefined) updateData.eventTimezone = eventTimezone;
		if (location !== undefined) updateData.location = location.trim();
		if (parsedLatitude !== undefined) updateData.latitude = parsedLatitude;
		if (parsedLongitude !== undefined) updateData.longitude = parsedLongitude;
		if (processedTags !== undefined) updateData.tags = processedTags;
		if (topics !== undefined) updateData.topics = Array.isArray(topics) ? topics : [];
		if (status !== undefined) updateData.status = status;
		if (pinnedAt !== undefined) {
			if (pinnedAt !== null) {
				// Enforce 3-pin limit before pinning
				const pinnedEventCount = await prisma.event.count({
					where: {
						OR: [
							{ userId: existing.userId },
							...(existing.pageId ? [{ pageId: existing.pageId }] : []),
						],
						pinnedAt: { not: null },
						id: { not: id },
					},
				});
				if (pinnedEventCount >= 3) {
					return badRequest("You can only pin up to 3 events.");
				}
				updateData.pinnedAt = new Date(pinnedAt);
			} else {
				updateData.pinnedAt = null;
			}
		}

		const event = await prisma.$transaction(async (tx) => {
			const updated = await tx.event.update({
				where: { id },
				data: updateData,
				select: eventWithUserFields,
			});
			if (reparentedVisibility !== undefined) {
				await syncDescendantVisibility("EVENT", id, reparentedVisibility, tx);
			}
			return updated;
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
		const { id } = await params;
		const viewer = await getViewerContext();
		if (!viewer.userId) {
			return unauthorized();
		}

		// Gate viewability first (404 for missing / not-viewable), then author-only delete (403).
		const existing = await requireViewableEvent(id, viewer);
		if (!existing) {
			return notFound("Event not found");
		}

		if (existing.userId !== viewer.userId) {
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
