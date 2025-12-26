import { PublicUser } from "./user";

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
 */
export interface BaseCollectionItem {
	id: string;
	title: string;
	description: string;
	tags: string[];
	owner: PublicUser;
	createdAt: Date;
	type: string; // Discriminator field - must be set by implementing types (e.g., "project", "event")
}

