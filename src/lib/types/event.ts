import { BaseCollectionItem } from "./collection-base";
import { ImageItem } from "./image";

/**
 * Event type - matches Prisma schema
 * Extends BaseCollectionItem with event-specific fields
 * The 'type' field is stored in the database as a discriminator for collection handling
 */
export interface EventItem extends BaseCollectionItem {
	type: "event";
	dateTime: Date;
	location: string;
	latitude: number | null;
	longitude: number | null;
	images: ImageItem[]; // Images associated with this event
	updatedAt: Date;
	// Deprecated: imageUrls kept for backward compatibility during migration
	imageUrls?: string[];
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

