// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { EventItem, EventCreateInput, EventUpdateInput } from "../../types/event";
import type { Prisma } from "@prisma/client";
import { eventWithOwnerFields } from "./fields";
import { deleteImage } from "./storage";
import { getActorIdForUser } from "./actor";
import { getImagesForTarget, getImagesForTargetsBatch, detachAllImagesForTarget } from "./image-attachment";
import { COLLECTION_ITEM_TYPES } from "@/lib/types/collection-base";

export async function getEventById(id: string): Promise<EventItem | null> {
	const event = await prisma.event.findUnique({
		where: { id },
		select: eventWithOwnerFields,
	});
	if (!event) return null;
	
	// Load images via ImageAttachment
	const images = await getImagesForTarget("EVENT", id);
	
	// Add type field and images for TypeScript discrimination
	const eventItem: EventItem = {
		...event,
		type: COLLECTION_ITEM_TYPES.EVENT,
		images,
	};
	return eventItem;
}

export interface GetAllEventsOptions {
	search?: string;
	limit?: number;
	offset?: number;
}

export async function getAllEvents(options?: GetAllEventsOptions): Promise<EventItem[]> {
	const search = options?.search;
	const where = search
		? {
				OR: [
					{ title: { contains: search, mode: "insensitive" as const } },
					{ description: { contains: search, mode: "insensitive" as const } },
					{ tags: { has: search } },
				],
		  }
		: {};

	const events = await prisma.event.findMany({
		where,
		select: eventWithOwnerFields,
		orderBy: { createdAt: "desc" },
		...(options?.offset !== undefined ? { skip: options.offset } : {}),
		...(options?.limit !== undefined ? { take: options.limit } : {}),
	});
	
	// Batch load images for all events (fixes N+1 query problem)
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);
	
	// Attach images to events
	const eventsWithImages: EventItem[] = events.map((e) => {
		const images = imagesMap.get(e.id) || [];
		return {
			...e,
			type: COLLECTION_ITEM_TYPES.EVENT,
			images,
		};
	});
	
	return eventsWithImages;
}

export async function getEventsByUser(userId: string): Promise<EventItem[]> {
	const actorId = await getActorIdForUser(userId);
	if (!actorId) return [];
	return getEventsByActor(actorId);
}

// Fetch all events by a specific actor (works for both users and orgs)
export async function getEventsByActor(actorId: string): Promise<EventItem[]> {
	const events = await prisma.event.findMany({
		where: { ownerActorId: actorId },
		select: eventWithOwnerFields,
		orderBy: { createdAt: "desc" },
	});
	
	// Batch load images for all events (fixes N+1 query problem)
	const eventIds = events.map(e => e.id);
	const imagesMap = await getImagesForTargetsBatch("EVENT", eventIds);
	
	// Attach images to events
	const eventsWithImages: EventItem[] = events.map((e) => {
		const images = imagesMap.get(e.id) || [];
		return {
			...e,
			type: COLLECTION_ITEM_TYPES.EVENT,
			images,
		};
	});
	
	return eventsWithImages;
}

export async function createEvent(ownerId: string, data: EventCreateInput): Promise<EventItem> {
	const actorId = await getActorIdForUser(ownerId);
	if (!actorId) {
		throw new Error("User not found or has no actor");
	}
	
	const event = await prisma.event.create({
		data: {
			title: data.title,
			description: data.description,
			dateTime: data.dateTime,
			location: data.location,
			latitude: data.latitude ?? null,
			longitude: data.longitude ?? null,
			tags: data.tags || [],
			ownerActorId: actorId,
		},
		select: eventWithOwnerFields,
	});
	// Load images via ImageAttachment
	const images = await getImagesForTarget("EVENT", event.id);
	
	// Add type field and images for TypeScript discrimination
	const eventItem: EventItem = {
		...event,
		type: COLLECTION_ITEM_TYPES.EVENT,
		images,
	};
	return eventItem;
}

export async function updateEvent(id: string, data: EventUpdateInput): Promise<EventItem> {
	const updateData: Prisma.EventUpdateInput = {};

	if (data.title !== undefined) {
		updateData.title = data.title;
	}

	if (data.description !== undefined) {
		updateData.description = data.description;
	}

	if (data.dateTime !== undefined) {
		updateData.dateTime = data.dateTime;
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

	// Note: Images should be managed separately via image API endpoints

	const event = await prisma.event.update({
		where: { id },
		data: updateData,
		select: eventWithOwnerFields,
	});
	
	// Load images via ImageAttachment
	const images = await getImagesForTarget("EVENT", event.id);
	
	// Add type field and images for TypeScript discrimination
	const eventItem: EventItem = {
		...event,
		type: COLLECTION_ITEM_TYPES.EVENT,
		images,
	};
	return eventItem;
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
		select: eventWithOwnerFields,
	});
	
	// Note: Images already deleted above, so we don't need to load them
	// Add type field for TypeScript discrimination
	const eventItem: EventItem = {
		...deletedEvent,
		type: COLLECTION_ITEM_TYPES.EVENT,
		images: [],
	};
	return eventItem;
}

