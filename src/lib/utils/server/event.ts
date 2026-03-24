// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { EventItem, EventCreateInput, EventUpdateInput } from "../../types/event";
import type { Prisma } from "@prisma/client";
import { eventWithUserFields, eventCollectionFields, EventFromQuery } from "./fields";
import { deleteImage } from "./storage";
import { getImagesForTarget, getImagesForTargetsBatch, detachAllImagesForTarget } from "./image-attachment";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import type { ImageItem } from "@/lib/types/image";

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

export interface GetAllEventsOptions {
	search?: string;
	limit?: number;
	offset?: number;
}

export async function getAllEvents(options?: GetAllEventsOptions): Promise<EventItem[]> {
	const search = options?.search;
	const where: Prisma.EventWhereInput = {
		status: "PUBLISHED",
		...(search
			? {
					OR: [
						{ title: { contains: search, mode: "insensitive" as const } },
						{ description: { contains: search, mode: "insensitive" as const } },
						{ tags: { has: search } },
					],
			  }
			: {}),
	};

	const events = await prisma.event.findMany({
		where,
		select: eventWithUserFields,
		orderBy: { createdAt: "desc" },
		...(options?.offset !== undefined ? { skip: options.offset } : {}),
		...(options?.limit !== undefined ? { take: options.limit } : {}),
	});

	// Batch load images for all events (fixes N+1 query problem)
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

	return events.map((e) => toEventItem(e, imagesMap.get(e.id) || []));
}

// Fetch all events by a specific user
export async function getEventsByUser(userId: string): Promise<EventItem[]> {
	const events = await prisma.event.findMany({
		where: { userId },
		select: eventCollectionFields,
		orderBy: { createdAt: "desc" },
	});

	// Batch load images for all events (fixes N+1 query problem)
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

	return events.map(({ _count, posts, ...e }) => ({
		...toEventItem(e, imagesMap.get(e.id) || []),
		_count: { posts: _count.posts },
		recentUpdate: posts[0] || null,
	}));
}

// Fetch all events for a page
export async function getEventsByPage(pageId: string): Promise<EventItem[]> {
	const events = await prisma.event.findMany({
		where: { pageId },
		select: eventCollectionFields,
		orderBy: { createdAt: "desc" },
	});

	// Batch load images for all events
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);

	return events.map(({ _count, posts, ...e }) => ({
		...toEventItem(e, imagesMap.get(e.id) || []),
		_count: { posts: _count.posts },
		recentUpdate: posts[0] || null,
	}));
}

export async function createEvent(userId: string, data: EventCreateInput, pageId?: string): Promise<EventItem> {
	const event = await prisma.event.create({
		data: {
			title: data.title,
			description: data.description,
			eventDateTime: data.eventDateTime,
			location: data.location,
			latitude: data.latitude ?? null,
			longitude: data.longitude ?? null,
			tags: data.tags || [],
			userId,
			pageId: pageId || null,
		},
		select: eventWithUserFields,
	});

	// New event has no images yet
	return toEventItem(event, []);
}

export async function updateEvent(id: string, data: EventUpdateInput): Promise<EventItem> {
	const updateData: Prisma.EventUpdateInput = {};

	if (data.title !== undefined) {
		updateData.title = data.title;
	}

	if (data.description !== undefined) {
		updateData.description = data.description;
	}

	if (data.eventDateTime !== undefined) {
		updateData.eventDateTime = data.eventDateTime;
	}

	if (data.location !== undefined) {
		updateData.location = data.location;
	}

	if (data.latitude !== undefined) {
		updateData.latitude = data.latitude;
	}

	if (data.longitude !== undefined) {
		updateData.longitude = data.longitude;
	}

	if (data.tags !== undefined) {
		updateData.tags = data.tags;
	}

	if (data.status !== undefined) {
		updateData.status = data.status;
	}

	// Note: Images should be managed separately via image API endpoints

	const event = await prisma.event.update({
		where: { id },
		data: updateData,
		select: eventWithUserFields,
	});

	const images = await getImagesForTarget("EVENT", event.id);
	return toEventItem(event, images);
}

export async function deleteEvent(id: string): Promise<EventItem> {
	// Fetch event to verify it exists
	const event = await prisma.event.findUnique({
		where: { id },
		select: { id: true },
	});

	if (!event) {
		throw new Error("Event not found");
	}

	// Get all images attached to this event
	const images = await getImagesForTarget("EVENT", id);

	// Delete all associated images from storage bucket
	for (const image of images) {
		if (image.url) {
			const result = await deleteImage(image.url);
			if (!result.success) {
				console.error(`Failed to delete image ${image.id} from storage:`, result.error);
				// Continue deleting other images even if one fails
			}
		}
	}

	// Delete all image attachments (cascade will handle image deletion if needed)
	await detachAllImagesForTarget("EVENT", id);

	// Delete the event (cascade will delete posts)
	const deletedEvent = await prisma.event.delete({
		where: { id },
		select: eventWithUserFields,
	});

	// Images already deleted above
	return toEventItem(deletedEvent, []);
}
