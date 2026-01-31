import type { PublicOwner } from "../utils/owner";
import { COLLECTION_TYPES } from "./collection";
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
 * - getCollectionItemDate(item): Returns the display date (eventDateTime for events, createdAt for projects)
 * - getCollectionItemUrl(item): Returns the detail page URL
 * - getCollectionItemType(item): Returns the type discriminator
 * 
 * Note: In v0.3, owner is an Owner (can be personal or org-based)
 */

export type CollectionItemType = (typeof COLLECTION_TYPES)[keyof typeof COLLECTION_TYPES];
export interface BaseCollectionItem {
	id: string;
	ownerId: string;
	title: string;
	description: string;
	tags: string[];
	topics: string[];
	owner: PublicOwner;
	createdAt: Date;
	updatedAt: Date;
	type: CollectionItemType;
}

