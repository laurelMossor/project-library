import { BaseCollectionItem } from "./collection-base";
import { ImageItem } from "./image";
import type { PostItem } from "./post";

/**
 * Event type - matches Prisma schema v2
 * Extends BaseCollectionItem with event-specific fields
 * Note: 'type' field is derived (not in database) for TypeScript type discrimination
 */
export interface EventItem extends BaseCollectionItem {
	type: "event"; // Derived field for type discrimination
	dateTime: Date;
	location: string;
	latitude: number | null;
	longitude: number | null;
	images: ImageItem[]; // Images associated with this event (via ImageAttachment)
	posts?: PostItem[]; // Descendant posts (optional, loaded when needed)
	updatedAt: Date;
}

export interface EventCreateInput {
	title: string;
	description: string;
	dateTime: Date;
	location: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
	// Note: Images should be uploaded separately and linked to the event after creation
}

export interface EventUpdateInput {
	title?: string;
	description?: string;
	dateTime?: Date;
	location?: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
	// Note: Images should be managed separately via image API endpoints
}

