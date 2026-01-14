import type { ActorOwner } from "../utils/owner";

/**
 * Base interface for all collection items (projects, events, etc.)
 * Defines the common structure that all collection types must implement.
 * 
 * This pattern makes it easier to add new collection types in the future:
 * 1. Create a new interface extending BaseCollectionItem
 * 2. Add the new type to the CollectionItem union
 * 3. Implement utility functions (getCollectionItemDate, getCollectionItemUrl, etc.)
 * 
 * Common utility functions:
 * - getCollectionItemDate(item): Returns the display date (dateTime for events, createdAt for projects)
 * - getCollectionItemUrl(item): Returns the detail page URL
 * - getCollectionItemType(item): Returns the type discriminator
 * 
 * Note: In v2, owner is an Actor (can be User or Org), not directly a PublicUser
 */

export const COLLECTION_ITEM_TYPES = {
	PROJECT: "project",
	EVENT: "event",
} as const;

export type CollectionItemType = typeof COLLECTION_ITEM_TYPES[keyof typeof COLLECTION_ITEM_TYPES];
export interface BaseCollectionItem {
	id: string;
	title: string;
	description: string;
	tags: string[];
	owner: ActorOwner; // Actor with user/org in v2
	createdAt: Date;
	type: CollectionItemType;
}

