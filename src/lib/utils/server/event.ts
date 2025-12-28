// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { EventItem, EventCreateInput, EventUpdateInput } from "../../types/event";
import type { Prisma } from "@prisma/client";
import { publicUserFields } from "./user";

const eventWithOwnerFields = {
	id: true,
	type: true,
	title: true,
	description: true,
	dateTime: true,
	location: true,
	latitude: true,
	longitude: true,
	tags: true,
	imageUrls: true,
	createdAt: true,
	updatedAt: true,
	owner: {
		select: publicUserFields,
	},
} as const;

export async function getEventById(id: string): Promise<EventItem | null> {
	const event = await prisma.event.findUnique({
		where: { id },
		select: eventWithOwnerFields,
	});
	if (!event) return null;
	return event as EventItem;
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
	return events as EventItem[];
}

export async function getEventsByUser(userId: string): Promise<EventItem[]> {
	const events = await prisma.event.findMany({
		where: { ownerId: userId },
		select: eventWithOwnerFields,
		orderBy: { createdAt: "desc" },
	});
	return events as EventItem[];
}

export async function createEvent(ownerId: string, data: EventCreateInput): Promise<EventItem> {
	const event = await prisma.event.create({
		data: {
			title: data.title,
			description: data.description,
			dateTime: data.dateTime,
			location: data.location,
			latitude: data.latitude ?? null,
			longitude: data.longitude ?? null,
			tags: data.tags || [],
			imageUrls: data.imageUrls || [],
			ownerId,
		},
		select: eventWithOwnerFields,
	});
	return event as EventItem;
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

	if (data.imageUrls !== undefined) {
		updateData.imageUrls = data.imageUrls;
	}

	const event = await prisma.event.update({
		where: { id },
		data: updateData,
		select: eventWithOwnerFields,
	});
	return event as EventItem;
}

export async function deleteEvent(id: string): Promise<EventItem> {
	const event = await prisma.event.delete({
		where: { id },
		select: eventWithOwnerFields,
	});
	return event as EventItem;
}

