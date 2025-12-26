import { ProjectItem } from "./project";
import { EventItem } from "./event";

export type CollectionItem = ProjectItem | EventItem;

export type CollectionItemType = "project" | "event";

/**
 * Type guard for ProjectItem - uses discriminator field for type safety
 */
export function isProject(item: CollectionItem): item is ProjectItem {
	return item.type === "project";
}

/**
 * Type guard for EventItem - uses discriminator field for type safety
 */
export function isEvent(item: CollectionItem): item is EventItem {
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

