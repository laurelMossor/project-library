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
	ABOUT: "about",
} as const;

export const FILTER_COLLECTION_TYPES = {
	ALL: "all",
	EVENT: COLLECTION_TYPES.EVENT,
	POST: COLLECTION_TYPES.POST,
} as const;

export type CollectionType = typeof COLLECTION_TYPES[keyof typeof COLLECTION_TYPES];

export type FilterCollectionType = (typeof FILTER_COLLECTION_TYPES)[keyof typeof FILTER_COLLECTION_TYPES];

/** Synthetic About card — not a DB record, generated from aboutContent. */
export type AboutCollectionItem = {
	type: "about";
	handle: string;
	displayName: string;
	excerpt: string;
};

export type CollectionItem = EventItem | PostCollectionItem;

// TODO: rethink about card treatment
/** Union for rendering contexts that include synthetic About cards. */
export type AnyCollectionItem = CollectionItem | AboutCollectionItem;

/**
 * Type guard for EventItem - uses discriminator field for type safety
 */
export function isEvent(item: AnyCollectionItem): item is EventItem {
	return item.type === COLLECTION_TYPES.EVENT;
}

export function isPost(item: AnyCollectionItem): item is PostCollectionItem {
	return item.type === COLLECTION_TYPES.POST;
}

export function isAbout(item: AnyCollectionItem): item is AboutCollectionItem {
	return item.type === COLLECTION_TYPES.ABOUT;
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

export function getCollectionItemCreatedAt(item: CollectionItem): Date {
	const dateValue = item.createdAt;
	if (dateValue instanceof Date) return dateValue;
	if (typeof dateValue === "string") return new Date(dateValue);
	return new Date();
}

export function isPastEvent(item: CollectionItem): boolean {
	if (!isEvent(item)) return false;
	const eventDate = getCollectionItemDate(item);
	return eventDate.getTime() < Date.now();
}
