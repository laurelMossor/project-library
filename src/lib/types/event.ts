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
	eventTimezone: string | null;
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
	eventTimezone?: string;
	location: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
}

export interface EventUpdateInput {
	title?: string | null;
	content?: string;
	eventDateTime?: Date;
	eventTimezone?: string | null;
	location?: string;
	latitude?: number | null;
	longitude?: number | null;
	tags?: string[];
	status?: EventStatus;
	// visibility is derived from the owning profile — never client-set.
}

/** Everything an event edit may change — the input to the update Server Action. */
export type EventUpdateData = {
	title?: string;
	content?: string;
	/** ISO string (or Date) for the start. */
	eventDateTime?: string | Date;
	eventTimezone?: string | null;
	location?: string;
	latitude?: number | string | null;
	longitude?: number | string | null;
	tags?: string[];
	topics?: string[];
	status?: EventStatus;
	/** ISO timestamp to pin, null to unpin. */
	pinnedAt?: string | null;
	pageId?: string | null;
	asPageId?: string | null;
	showOnAuthorProfile?: boolean;
};

/** Input to the create Server Action. */
export type EventCreateData = Omit<EventUpdateData, "status" | "pinnedAt"> & {
	/** A draft (the inline-edit entry point) is lenient: blank fields and a default date a week out. */
	isDraft?: boolean;
};
