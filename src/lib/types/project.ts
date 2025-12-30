import { BaseCollectionItem } from "./collection-base";
import { ImageItem } from "./image";

/**
 * Project type - matches Prisma schema
 * Extends BaseCollectionItem with project-specific fields
 * The 'type' field is stored in the database as a discriminator for collection handling
 */
export interface ProjectItem extends BaseCollectionItem {
	type: "project";
	images: ImageItem[]; // Images associated with this project
	updatedAt: Date;
	// Deprecated: imageUrl kept for backward compatibility during migration
	imageUrl?: string | null;
}

export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
	// Note: Images should be uploaded separately via /api/projects/upload
	// and linked to the project after creation
}

import { EntryItem } from "./entry";

/**
 * Helper to convert EntryItem to ProjectEntryItem (for backward compatibility)
 */
export function entryToProjectEntry(entry: EntryItem): EntryItem {
	if (entry.collectionType !== "project") {
		throw new Error("Entry is not a project entry");
	}
	return {
		id: entry.id,
		collectionType: "project",
		collectionId: entry.collectionId,
		title: entry.title,
		content: entry.content,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt,
	};
}
