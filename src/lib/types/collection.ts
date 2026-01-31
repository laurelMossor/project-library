import { BaseCollectionItem } from "./collection-item";
import { ProjectItem } from "./project";
import { EventItem } from "./event";

// Re-export BaseCollectionItem for convenience
export type { BaseCollectionItem } from "./collection-item";

/**
 * Collection type constants - all valid collection types
 */
export const COLLECTION_TYPES = {
	PROJECT: "project",
	EVENT: "event",
	POST: "post",
} as const;

export const FILTER_COLLECTION_TYPES = {
	ALL: "all",
	PROJECT: COLLECTION_TYPES.PROJECT,
	EVENT: COLLECTION_TYPES.EVENT,
	POST: COLLECTION_TYPES.POST,
} as const;

export type CollectionType = typeof COLLECTION_TYPES[keyof typeof COLLECTION_TYPES];

export type FilterCollectionType = (typeof FILTER_COLLECTION_TYPES)[keyof typeof FILTER_COLLECTION_TYPES];

export type CollectionItem = ProjectItem | EventItem;

export function isProject(item: CollectionItem): item is ProjectItem {
	return item.type === COLLECTION_TYPES.PROJECT;
}

/**
 * Type guard for EventItem - uses discriminator field for type safety
 */
export function isEvent(item: CollectionItem): item is EventItem {
	return item.type === COLLECTION_TYPES.EVENT;
}

/**
 * Get the collection item type using the discriminator field
 */
export function getCollectionItemType(item: CollectionItem): CollectionType {
	return item.type;
}

export function getCollectionItemDate(item: CollectionItem): Date {
	const dateValue = isEvent(item) ? item.eventDateTime : item.createdAt;
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
