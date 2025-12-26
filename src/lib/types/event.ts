import { BaseCollectionItem } from "./collection-base";

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
	imageUrls: string[];
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
	imageUrls?: string[];
}

export interface EventUpdateInput {
	title?: string;
	description?: string;
	dateTime?: Date;
	location?: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
	imageUrls?: string[];
}

