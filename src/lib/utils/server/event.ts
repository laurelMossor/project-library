// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { AttachmentTarget } from "@prisma/client";
import { prisma } from "./prisma";
import { EventItem } from "../../types/event";
import { eventWithUserFields, eventCollectionFields, EventFromQuery, toCollectionMeta } from "./fields";
import { getImagesForTarget, getImagesForTargetsBatch, detachAllForTargets } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ImageItem } from "@/lib/types/image";
import type { ViewerContext } from "./visibility";
import { authorProfilePlacementWhere, collectionVisibilityWhere, draftsOnPageWhere } from "./visibility";
import { withCanPin } from "./pin";

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
	const personal = await collectionVisibilityWhere("USER", userId, viewer);
	const placed = await authorProfilePlacementWhere(viewer);
	const events = await prisma.event.findMany({
		where: {
			userId,
			...(includeDrafts ? {} : { status: "PUBLISHED" }),
			OR: [{ pageId: null, ...personal }, placed],
		},
		select: eventCollectionFields,
		orderBy: { createdAt: "desc" },
	});

	// Batch load images for all events (fixes N+1 query problem)
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

	return withCanPin(events.map(({ _count, updates, ...e }) => ({
		...toEventItem(e, imagesMap.get(e.id) || []),
		...toCollectionMeta({ _count, updates }),
	})), viewer?.userId ?? null, { userId });
}

// Fetch all events for a page
export async function getEventsByPage(
	pageId: string,
	{ includeDrafts = false, viewer }: { includeDrafts?: boolean; viewer?: ViewerContext } = {}
): Promise<EventItem[]> {
	const events = await prisma.event.findMany({
		where: {
			pageId,
			...draftsOnPageWhere(includeDrafts, viewer),
			...(await collectionVisibilityWhere("PAGE", pageId, viewer)),
		},
		select: eventCollectionFields,
		orderBy: { createdAt: "desc" },
	});

	// Batch load images for all events
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

	return withCanPin(events.map(({ _count, updates, ...e }) => ({
		...toEventItem(e, imagesMap.get(e.id) || []),
		...toCollectionMeta({ _count, updates }),
	})), viewer?.userId ?? null, { pageId });
}

// NOTE: event creation/updates go through the route handlers (`POST`/`PATCH /api/events[/:id]`),
// which own their own validation, permission, image, and re-parent-visibility logic. The former
// `createEvent`/`updateEvent` server utils here were unused (the client `event-client.ts` has its
// own same-named fetch wrappers) and were removed to avoid a second, divergent write path.

/**
 * Delete an event and return storage paths to remove after commit.
 * Update posts cascade with the event, but their photos are POST attachments
 * with no foreign key, so they are detached here too. Blobs stay until the caller
 * removes the returned paths, so a failed delete does not drop the photos.
 */
export async function deleteEvent(id: string): Promise<string[]> {
	return prisma.$transaction(async (tx) => {
		// A new update's eventId foreign key share-locks this row, so it waits.
		await tx.$queryRaw`SELECT id FROM "events" WHERE id = ${id} FOR UPDATE`;
		const posts = await tx.post.findMany({ where: { eventId: id }, select: { id: true } });
		const paths = await detachAllForTargets(
			[
				{ type: AttachmentTarget.EVENT, targetId: id },
				...posts.map((post) => ({ type: AttachmentTarget.POST, targetId: post.id })),
			],
			tx,
		);
		await tx.event.delete({ where: { id } });
		return paths;
	}, { timeout: 30_000, maxWait: 10_000 });
}
