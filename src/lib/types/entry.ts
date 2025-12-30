import { CollectionType } from "./collection";

/**
 * Entry type - matches Prisma schema
 * Represents an entry/update for any collection type (Project, Event, Post, etc.)
 * Uses polymorphic pattern with collectionType and collectionId
 */
export interface EntryItem {
	id: string;
	collectionType: CollectionType; // Type of collection this entry belongs to
	collectionId: string; // ID of the collection item
	title: string | null; // optional entry title
	content: string; // entry text content
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Entry data for creating a new entry
 * Derived from EntryItem, excluding auto-generated fields
 */
export type EntryCreateInput = Omit<EntryItem, "id" | "createdAt" | "updatedAt">;

/**
 * Entry data for updating an existing entry
 * Only updatable fields
 */
export type EntryUpdateInput = Partial<Pick<EntryItem, "title" | "content">>;

/**
 * Type guard to check if entry belongs to a project
 */
export function isProjectEntry(entry: EntryItem): entry is EntryItem & { collectionType: "project" } {
	return entry.collectionType === "project";
}

/**
 * Type guard to check if entry belongs to an event
 */
export function isEventEntry(entry: EntryItem): entry is EntryItem & { collectionType: "event" } {
	return entry.collectionType === "event";
}

