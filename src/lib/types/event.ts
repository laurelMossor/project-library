import { BaseCollectionItem } from "./collection-item";
import { ImageItem } from "./image";
import type { PostItem } from "./post";

/**
 * Event type - matches Prisma schema v0.4
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
	updates?: PostItem[]; // Child posts (optional, loaded when needed)
}

export interface EventCreateInput {
	title: string;
	content: string;
	eventDateTime: Date;
	location: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
}

export interface EventUpdateInput {
	title?: string | null;
	content?: string;
	eventDateTime?: Date;
	location?: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
	status?: EventStatus;
}
