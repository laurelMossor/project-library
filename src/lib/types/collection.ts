import { Project } from "./project";
import { Event } from "./event";

export type CollectionItem = Project | Event;

export type CollectionItemType = "project" | "event";

/**
 * Type guard for Project - uses discriminator field for type safety
 */
export function isProject(item: CollectionItem): item is Project {
	return item.type === "project";
}

/**
 * Type guard for Event - uses discriminator field for type safety
 */
export function isEvent(item: CollectionItem): item is Event {
	return item.type === "event";
}

/**
 * Get the collection item type using the discriminator field
 */
export function getCollectionItemType(item: CollectionItem): CollectionItemType {
	return item.type;
}

export function getCollectionItemDate(item: CollectionItem): Date {
	const dateValue = isEvent(item) ? item.dateTime : item.createdAt;
	// Handle both Date objects and date strings from API
	if (dateValue instanceof Date) {
		return dateValue;
	}
	if (typeof dateValue === "string") {
		return new Date(dateValue);
	}
	// Fallback (shouldn't happen, but TypeScript needs it)
	return new Date();
}

