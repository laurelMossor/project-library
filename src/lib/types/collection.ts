import { EventItem } from "./event";
import { PostCollectionItem } from "./post";

// Re-export BaseCollectionItem for convenience
export type { BaseCollectionItem } from "./collection-item";

/**
 * Collection type constants - all valid collection types
 */
export const COLLECTION_TYPES = {
	EVENT: "event",
	POST: "post",
} as const;

export const FILTER_COLLECTION_TYPES = {
	ALL: "all",
	EVENT: COLLECTION_TYPES.EVENT,
	POST: COLLECTION_TYPES.POST,
} as const;

export type CollectionType = typeof COLLECTION_TYPES[keyof typeof COLLECTION_TYPES];

export type FilterCollectionType = (typeof FILTER_COLLECTION_TYPES)[keyof typeof FILTER_COLLECTION_TYPES];

export type CollectionItem = EventItem | PostCollectionItem;

/**
 * Type guard for EventItem - uses discriminator field for type safety
 */
export function isEvent(item: CollectionItem): item is EventItem {
	return item.type === COLLECTION_TYPES.EVENT;
}

export function isPost(item: CollectionItem): item is PostCollectionItem {
	return item.type === COLLECTION_TYPES.POST;
}

/**
 * Get the collection item type using the discriminator field
 */
export function getCollectionItemType(item: CollectionItem): CollectionType {
	return item.type;
}

export function getCollectionItemDate(item: CollectionItem): Date {
	if (isEvent(item)) {
		const dateValue = item.eventDateTime;
		if (dateValue instanceof Date) return dateValue;
		if (typeof dateValue === "string") return new Date(dateValue);
		return new Date();
	}
	// For posts, use createdAt
	const dateValue = item.createdAt;
	if (dateValue instanceof Date) return dateValue;
	if (typeof dateValue === "string") return new Date(dateValue);
	return new Date();
}
