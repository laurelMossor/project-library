// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { EventItem } from "../../types/event";
import { eventWithUserFields, eventCollectionFields, EventFromQuery, toCollectionMeta } from "./fields";
import { getImagesForTarget, getImagesForTargetsBatch, deleteAllAttachmentsForTarget } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ImageItem } from "@/lib/types/image";
import type { ViewerContext } from "./visibility";
import { collectionVisibilityWhere } from "./visibility";

/** Transform Prisma query result to EventItem */
function toEventItem(event: EventFromQuery, images: ImageItem[]): EventItem {
	return {
		...event,
		type: COLLECTION_TYPES.EVENT,
		images,
	};
}

export async function getEventById(id: string): Promise<EventItem | null> {
	const event = await prisma.event.findUnique({
		where: { id },
		select: eventWithUserFields,
	});
	if (!event) return null;

	const images = await getImagesForTarget("EVENT", id);
	return toEventItem(event, images);
}

// Fetch all events by a specific user
export async function getEventsByUser(
	userId: string,
	{ includeDrafts = false, viewer }: { includeDrafts?: boolean; viewer?: ViewerContext } = {}
): Promise<EventItem[]> {
	const events = await prisma.event.findMany({
		where: {
			userId,
			pageId: null,
			...(includeDrafts ? {} : { status: "PUBLISHED" }),
			...(await collectionVisibilityWhere("USER", userId, viewer)),
		},
		select: eventCollectionFields,
		orderBy: { createdAt: "desc" },
	});

	// Batch load images for all events (fixes N+1 query problem)
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

	return events.map(({ _count, updates, ...e }) => ({
		...toEventItem(e, imagesMap.get(e.id) || []),
		...toCollectionMeta({ _count, updates }),
	}));
}

// Fetch all events for a page
export async function getEventsByPage(
	pageId: string,
	{ includeDrafts = false, viewer }: { includeDrafts?: boolean; viewer?: ViewerContext } = {}
): Promise<EventItem[]> {
	const events = await prisma.event.findMany({
		where: {
			pageId,
			...(includeDrafts ? {} : { status: "PUBLISHED" }),
			...(await collectionVisibilityWhere("PAGE", pageId, viewer)),
		},
		select: eventCollectionFields,
		orderBy: { createdAt: "desc" },
	});

	// Batch load images for all events
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

	return events.map(({ _count, updates, ...e }) => ({
		...toEventItem(e, imagesMap.get(e.id) || []),
		...toCollectionMeta({ _count, updates }),
	}));
}

// NOTE: event creation/updates go through the route handlers (`POST`/`PATCH /api/events[/:id]`),
// which own their own validation, permission, image, and re-parent-visibility logic. The former
// `createEvent`/`updateEvent` server utils here were unused (the client `event-client.ts` has its
// own same-named fetch wrappers) and were removed to avoid a second, divergent write path.

export async function deleteEvent(id: string): Promise<EventItem> {
	// Fetch event to verify it exists
	const event = await prisma.event.findUnique({
		where: { id },
		select: { id: true },
	});

	if (!event) {
		throw new Error("Event not found");
	}

	// Remove every attached image (attachment row + Image row + storage blob). The event
	// is going away, so no uploader scoping — all images attached to it are cleaned up.
	await deleteAllAttachmentsForTarget("EVENT", id);

	// Delete the event (cascade will delete posts)
	const deletedEvent = await prisma.event.delete({
		where: { id },
		select: eventWithUserFields,
	});

	// Images already deleted above
	return toEventItem(deletedEvent, []);
}
