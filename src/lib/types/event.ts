import { BaseCollectionItem } from "./collection-item";
import { ImageItem } from "./image";
import type { PostItem } from "./post";

/**
 * Event type - matches Prisma schema v0.3
 * Extends BaseCollectionItem with event-specific fields
 * Note: 'type' field is derived (not in database) for TypeScript type discrimination
 */
export type EventStatus = "DRAFT" | "PUBLISHED";

export interface EventItem extends BaseCollectionItem {
	type: "event"; // Derived field for type discrimination
	eventDateTime: Date;
	location: string;
	latitude: number | null;
	longitude: number | null;
	status: EventStatus;
	images: ImageItem[]; // Images associated with this event (via ImageAttachment)
	posts?: PostItem[]; // Descendant posts (optional, loaded when needed)
}

export interface EventCreateInput {
	title: string;
	description: string;
	eventDateTime: Date;
	location: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
	// Note: Images should be uploaded separately and linked to the event after creation
}

export interface EventUpdateInput {
	title?: string;
	description?: string;
	eventDateTime?: Date;
	location?: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
	status?: EventStatus;
	// Note: Images should be managed separately via image API endpoints
}

