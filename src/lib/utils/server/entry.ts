// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { CollectionType } from "@/lib/types/collection";
import { prisma } from "./prisma";
import type { EntryItem } from "@/lib/types/entry";

// Fetch all entries for a collection, sorted by createdAt (newest first)
export async function getAllEntries(
	collectionId: string,
	collectionType: CollectionType
): Promise<EntryItem[]> {
	const entries = await prisma.entry.findMany({
		where: { collectionId, collectionType },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			collectionId: true,
			collectionType: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return entries as EntryItem[];
}

// Create a new entry for a collection
export async function createEntry(
	collectionId: string,
	collectionType: CollectionType,
	data: { title?: string; content: string }
): Promise<EntryItem> {
	// Validate content is not empty
	if (!data.content || data.content.trim().length === 0) {
		throw new Error("Content is required and cannot be empty");
	}

	// Verify collection exists based on type
	if (collectionType === "project") {
		const project = await prisma.project.findUnique({
			where: { id: collectionId },
			select: { id: true },
		});
		if (!project) {
			throw new Error("Project not found");
		}
	} else if (collectionType === "event") {
		const event = await prisma.event.findUnique({
			where: { id: collectionId },
			select: { id: true },
		});
		if (!event) {
			throw new Error("Event not found");
		}
	} else {
		throw new Error(`Unsupported collection type: ${collectionType}`);
	}

	// Create the entry
	const entry = await prisma.entry.create({
		data: {
			collectionId,
			collectionType,
			title: data.title?.trim() || null,
			content: data.content.trim(),
		},
		select: {
			id: true,
			collectionId: true,
			collectionType: true,
			title: true,
			content: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return entry as EntryItem;
}

