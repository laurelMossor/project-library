import { NextResponse } from "next/server";
import { ContentVisibility } from "@prisma/client";
import { prisma } from "@/lib/utils/server/prisma";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateEventUpdateData, validateEventPublishable } from "@/lib/validations";
import { eventWithUserFields } from "@/lib/utils/server/fields";
import { canEditContent, canModerateContent } from "@/lib/utils/server/permission";
import { PlacementError, resolveContentPlacement } from "@/lib/utils/server/content-placement";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { deleteEvent } from "@/lib/utils/server/event";
import { removeStoragePaths } from "@/lib/utils/server/storage";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import { getViewerContext, canViewEvent, isContentOwner, requireViewableEvent, resolveParentVisibility, syncDescendantVisibility } from "@/lib/utils/server/visibility";
import { MAX_PINNED_PER_PROFILE, PIN_CAP_MESSAGE } from "@/lib/const/pin";
import { canPinContent, otherPinnedCount } from "@/lib/utils/server/pin";

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

		const data = await request.json();
		const pinOnly = data.pinnedAt !== undefined
			&& Object.keys(data).every((key) => key === "pinnedAt")
			&& (await canPinContent(viewer.userId, { userId: existing.userId, pageId: existing.pageId }));
		if (!pinOnly && !(await canEditContent(viewer.userId, existing))) {
			return NextResponse.json(
				{ error: "You can only edit your own events" },
				{ status: 403 }
			);
		}
		// `visibility` is intentionally NOT accepted here — content visibility is
		// derived from the owning profile's contentVisibility, never client-set.
		const { title, content, eventDateTime, eventTimezone, location, latitude, longitude, tags, topics, status, pinnedAt, pageId, asPageId, showOnAuthorProfile } = data;

		const placementTouched = pageId !== undefined || asPageId !== undefined || showOnAuthorProfile !== undefined;
		let placement: { pageId: string | null; asPageId: string | null; showOnAuthorProfile: boolean } | null = null;
		if (placementTouched) {
			if (existing.status !== "DRAFT") {
				return badRequest("A published event's placement can't change");
			}
			try {
				placement = await resolveContentPlacement(viewer.userId, {
					asPageId: asPageId !== undefined ? asPageId : existing.asPageId,
					pageId: pageId !== undefined ? pageId : existing.pageId,
					showOnAuthorProfile: showOnAuthorProfile !== undefined ? showOnAuthorProfile : existing.showOnAuthorProfile,
				});
			} catch (err) {
				if (err instanceof PlacementError) return badRequest(err.message);
				throw err;
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

		// INV-10: publishing a draft requires a complete event. validateEventUpdateData only
		// checks fields *present* in the patch, so a draft created empty could otherwise be
		// flipped to PUBLISHED blank. Merge the stored row with the incoming patch and gate.
		if (status === "PUBLISHED" && existing.status === "DRAFT") {
			const stored = await prisma.event.findUnique({
				where: { id },
				select: {
					title: true, content: true, eventDateTime: true, eventTimezone: true,
					location: true, latitude: true, longitude: true, tags: true,
				},
			});
			const publishCheck = validateEventPublishable({
				title: (title !== undefined ? title : stored?.title) ?? "",
				content: (content !== undefined ? content : stored?.content) ?? "",
				eventDateTime: parsedDateTime !== undefined ? parsedDateTime : stored?.eventDateTime ?? new Date(0),
				eventTimezone: (eventTimezone !== undefined ? eventTimezone : stored?.eventTimezone) ?? undefined,
				location: (location !== undefined ? location : stored?.location) ?? "",
				latitude: parsedLatitude !== undefined ? parsedLatitude : stored?.latitude,
				longitude: parsedLongitude !== undefined ? parsedLongitude : stored?.longitude,
				tags: processedTags !== undefined ? processedTags : stored?.tags,
			});
			if (!publishCheck.valid) {
				return badRequest(publishCheck.error || "Cannot publish an incomplete event");
			}
		}

		const updateData: Record<string, unknown> = {};
		// Re-parenting (host page change) re-derives the event's content visibility from the new
		// owner and cascades to its child posts, so a private-page event can't retain a broader
		// visibility than its new parent allows (findings 2/3). Never client-set.
		let reparentedVisibility: ContentVisibility | undefined;
		if (placement) {
			updateData.pageId = placement.pageId;
			updateData.asPageId = placement.asPageId;
			updateData.showOnAuthorProfile = placement.showOnAuthorProfile;
			if (placement.pageId !== existing.pageId) {
				reparentedVisibility = await resolveParentVisibility(existing.userId, placement.pageId, null);
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
		const pinPageId = placement?.pageId ?? existing.pageId;
		if (pinnedAt !== undefined) {
			if (!(await canPinContent(viewer.userId, { userId: existing.userId, pageId: pinPageId }))) {
				return badRequest(pinPageId
					? "Only page editors can pin events on this page"
					: "You can only pin your own events");
			}
			if (pinnedAt !== null) {
				const pinnedCount = await otherPinnedCount(
					pinPageId ? { pageId: pinPageId } : { userId: existing.userId },
					{ eventId: id },
				);
				if (pinnedCount >= MAX_PINNED_PER_PROFILE) {
					return badRequest(PIN_CAP_MESSAGE);
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

		if (!(await canModerateContent(viewer.userId, existing))) {
			return NextResponse.json(
				{ error: "You can only delete your own events" },
				{ status: 403 }
			);
		}

		const paths = await deleteEvent(id);
		await removeStoragePaths(paths);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/events/:id error:", error);
		return serverError("Failed to delete event");
	}
}
