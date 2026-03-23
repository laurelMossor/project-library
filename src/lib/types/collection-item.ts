import { COLLECTION_TYPES } from "./collection";
/**
 * Base interface for all collection items (events, etc.)
 * Defines the common structure that all collection types must implement.
 *
 * This pattern makes it easier to add new collection types in the future:
 * 1. Create a new interface extending BaseCollectionItem
 * 2. Add the new type to the CollectionItem union
 * 3. Implement utility functions (getCollectionItemDate, getCollectionItemUrl, etc.)
 *
 * Common utility functions:
 * - getCollectionItemDate(item): Returns the display date (eventDateTime for events, createdAt for others)
 * - getCollectionItemUrl(item): Returns the detail page URL
 * - getCollectionItemType(item): Returns the type discriminator
 *
 * Note: In v0.4, user is direct (no more Owner indirection)
 */

export type CollectionItemType = (typeof COLLECTION_TYPES)[keyof typeof COLLECTION_TYPES];
export interface BaseCollectionItem {
	id: string;
	userId: string;
	title: string;
	description: string;
	tags: string[];
	topics: string[];
	user: { id: string; username: string; displayName: string | null; firstName: string | null; lastName: string | null; avatarImageId: string | null };
	page: { id: string; name: string; slug: string; avatarImageId: string | null } | null;
	createdAt: Date;
	updatedAt: Date;
	type: CollectionItemType;
}
