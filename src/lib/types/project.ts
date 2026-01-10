import { BaseCollectionItem } from "./collection-base";
import { ImageItem } from "./image";
import type { PostItem } from "./post";

/**
 * Project type - matches Prisma schema v2
 * Extends BaseCollectionItem with project-specific fields
 * Note: 'type' field is derived (not in database) for TypeScript type discrimination
 */
export interface ProjectItem extends BaseCollectionItem {
	type: "project"; // Derived field for type discrimination
	images: ImageItem[]; // Images associated with this project (via ImageAttachment)
	posts?: PostItem[]; // Descendant posts (optional, loaded when needed)
	updatedAt: Date;
}

export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
	// Note: Images should be uploaded separately via /api/projects/upload
	// and linked to the project after creation
}

export interface ProjectUpdateInput {
	title?: string;
	description?: string;
	tags?: string[];
	// Note: Images should be managed separately via image API endpoints
}

