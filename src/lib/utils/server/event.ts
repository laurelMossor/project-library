// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { AttachmentTarget, ContentVisibility, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { EventItem, type EventCreateData, type EventUpdateData } from "../../types/event";
import { DomainError } from "./domain-error";
import { canEditContent, canModerateContent } from "./permission";
import { resolveContentPlacement } from "./content-placement";
import { removeStoragePaths } from "./storage";
import { isValidCoordinate, validateEventData, validateEventPublishable, validateEventUpdateData } from "@/lib/validations";
import { logAction } from "./log";
import { eventWithUserFields, eventCollectionFields, EventFromQuery, toCollectionMeta } from "./fields";
import { getImagesForTarget, getImagesForTargetsBatch, detachAllForTargets } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ImageItem } from "@/lib/types/image";
import type { ViewerContext } from "./visibility";
import { authorProfilePlacementWhere, collectionVisibilityWhere, draftsOnPageWhere, requireViewableEvent, resolveParentVisibility, syncDescendantVisibility } from "./visibility";
import { assertPinChange, canPinContent, withCanPin } from "./pin";

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
function parseNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

/**
 * Create an event — the single write path for event creation. A draft is lenient (blank
 * fields, default date a week out, but a pin must be a valid pair); otherwise the full
 * create validation applies and it's born PUBLISHED. Returns the new event's id.
 */
export async function createEvent(userId: string, data: EventCreateData): Promise<string> {
	const { title, content, eventDateTime, eventTimezone, location, latitude, longitude, tags, topics, isDraft, pageId, asPageId, showOnAuthorProfile } = data;

	const placement = await resolveContentPlacement(userId, { asPageId, pageId, showOnAuthorProfile });
	const contentVisibility = await resolveParentVisibility(userId, placement.pageId);
	const cleanTags = tags?.map((tag) => String(tag).trim()).filter(Boolean) ?? [];
	const parsedLatitude = parseNumber(latitude);
	const parsedLongitude = parseNumber(longitude);

	let fields: { title: string; content: string; eventDateTime: Date; location: string };
	if (isDraft) {
		// A lenient draft still shouldn't store a garbage pin.
		if ((parsedLatitude !== null || parsedLongitude !== null)
			&& !(parsedLatitude !== null && parsedLongitude !== null && isValidCoordinate(parsedLatitude, parsedLongitude))) {
			throw new DomainError("Invalid event coordinates");
		}
		fields = {
			title: (title || "").trim(),
			content: (content || "").trim(),
			eventDateTime: eventDateTime ? new Date(eventDateTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			location: (location || "").trim(),
		};
	} else {
		const parsedDateTime = eventDateTime ? new Date(eventDateTime) : null;
		if (!parsedDateTime || isNaN(parsedDateTime.getTime())) throw new DomainError("Event date is required and must be valid");
		const validation = validateEventData({
			title: title ?? "",
			content: content ?? "",
			eventDateTime: parsedDateTime,
			location: location ?? "",
			latitude: parsedLatitude ?? undefined,
			longitude: parsedLongitude ?? undefined,
			tags: cleanTags,
		});
		if (!validation.valid) throw new DomainError(validation.error ?? "Invalid event data");
		fields = { title: (title ?? "").trim(), content: (content ?? "").trim(), eventDateTime: parsedDateTime, location: (location ?? "").trim() };
	}

	const event = await prisma.event.create({
		data: {
			userId,
			pageId: placement.pageId,
			asPageId: placement.asPageId,
			showOnAuthorProfile: placement.showOnAuthorProfile,
			...fields,
			eventTimezone: eventTimezone || null,
			latitude: parsedLatitude,
			longitude: parsedLongitude,
			tags: cleanTags,
			topics: Array.isArray(topics) ? topics : [],
			contentVisibility,
			status: isDraft ? "DRAFT" : "PUBLISHED",
		},
		select: { id: true },
	});
	logAction("event.created", userId, { eventId: event.id, status: isDraft ? "DRAFT" : "PUBLISHED" });
	return event.id;
}

/**
 * Update an event as the viewer — the single write path for edits, publish, placement, and pins.
 * Not viewable → not_found (no existence oracle). Pin-only changes need pin rights; everything
 * else needs edit rights. Placement can change only while it's a draft; re-parenting re-derives
 * visibility for the event and its child posts. Publishing a draft gates on the merged row.
 */
export async function updateEvent(viewer: ViewerContext & { userId: string }, id: string, data: EventUpdateData): Promise<void> {
	const existing = await requireViewableEvent(id, viewer);
	if (!existing) throw new DomainError("Event not found", "not_found");

	const pinOnly = data.pinnedAt !== undefined
		&& Object.keys(data).every((key) => key === "pinnedAt")
		&& (await canPinContent(viewer.userId, { userId: existing.userId, pageId: existing.pageId }));
	if (!pinOnly && !(await canEditContent(viewer.userId, existing))) {
		throw new DomainError("You can only edit your own events", "forbidden");
	}
	// `visibility` is intentionally not accepted — it's derived from the owning profile, never client-set.
	const { title, content, eventDateTime, eventTimezone, location, latitude, longitude, tags, topics, status, pinnedAt, pageId, asPageId, showOnAuthorProfile } = data;

	let placement: { pageId: string | null; asPageId: string | null; showOnAuthorProfile: boolean } | null = null;
	if (pageId !== undefined || asPageId !== undefined || showOnAuthorProfile !== undefined) {
		if (existing.status !== "DRAFT") throw new DomainError("A published event's placement can't change");
		placement = await resolveContentPlacement(viewer.userId, {
			asPageId: asPageId !== undefined ? asPageId : existing.asPageId,
			pageId: pageId !== undefined ? pageId : existing.pageId,
			showOnAuthorProfile: showOnAuthorProfile !== undefined ? showOnAuthorProfile : existing.showOnAuthorProfile,
		});
	}

	const parsedDateTime = eventDateTime !== undefined ? new Date(eventDateTime) : undefined;
	const parsedLatitude = latitude !== undefined ? parseNumber(latitude) : undefined;
	const parsedLongitude = longitude !== undefined ? parseNumber(longitude) : undefined;
	const cleanTags = tags?.map((tag) => String(tag).trim()).filter(Boolean);

	const validation = validateEventUpdateData({
		title,
		content,
		eventDateTime: parsedDateTime,
		location,
		latitude: parsedLatitude ?? undefined,
		longitude: parsedLongitude ?? undefined,
		tags: cleanTags,
		status,
	});
	if (!validation.valid) throw new DomainError(validation.error ?? "Invalid event data");

	// INV-10: publishing a draft requires a complete event. validateEventUpdateData only checks
	// fields present in the patch, so merge the stored row with the patch and gate on that.
	if (status === "PUBLISHED" && existing.status === "DRAFT") {
		const stored = await prisma.event.findUnique({
			where: { id },
			select: { title: true, content: true, eventDateTime: true, eventTimezone: true, location: true, latitude: true, longitude: true, tags: true },
		});
		const publishCheck = validateEventPublishable({
			title: (title !== undefined ? title : stored?.title) ?? "",
			content: (content !== undefined ? content : stored?.content) ?? "",
			eventDateTime: parsedDateTime !== undefined ? parsedDateTime : stored?.eventDateTime ?? new Date(0),
			eventTimezone: (eventTimezone !== undefined ? eventTimezone : stored?.eventTimezone) ?? undefined,
			location: (location !== undefined ? location : stored?.location) ?? "",
			latitude: parsedLatitude !== undefined ? parsedLatitude : stored?.latitude,
			longitude: parsedLongitude !== undefined ? parsedLongitude : stored?.longitude,
			tags: cleanTags !== undefined ? cleanTags : stored?.tags,
		});
		if (!publishCheck.valid) throw new DomainError(publishCheck.error ?? "Cannot publish an incomplete event");
	}

	if (pinnedAt !== undefined) {
		await assertPinChange(viewer.userId, { kind: "event", id, userId: existing.userId, pageId: placement?.pageId ?? existing.pageId }, pinnedAt);
	}

	const updateData: Prisma.EventUncheckedUpdateInput = {};
	// Re-parenting (host page change) re-derives the event's content visibility from the new
	// owner and cascades to its child posts, so a private-page event can't keep a broader
	// visibility than its new parent allows. Never client-set.
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
	if (cleanTags !== undefined) updateData.tags = cleanTags;
	if (topics !== undefined) updateData.topics = Array.isArray(topics) ? topics : [];
	if (status !== undefined) updateData.status = status;
	if (pinnedAt !== undefined) updateData.pinnedAt = pinnedAt === null ? null : new Date(pinnedAt);

	await prisma.$transaction(async (tx) => {
		await tx.event.update({ where: { id }, data: updateData });
		if (reparentedVisibility !== undefined) {
			await syncDescendantVisibility("EVENT", id, reparentedVisibility, tx);
		}
	});
}

/** Delete an event as the viewer: not viewable → not_found, then moderation rights; then its photo blobs. */
export async function removeEvent(viewer: ViewerContext & { userId: string }, id: string): Promise<void> {
	const existing = await requireViewableEvent(id, viewer);
	if (!existing) throw new DomainError("Event not found", "not_found");
	if (!(await canModerateContent(viewer.userId, existing))) {
		throw new DomainError("You can only delete your own events", "forbidden");
	}
	await removeStoragePaths(await deleteEvent(id));
}

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
