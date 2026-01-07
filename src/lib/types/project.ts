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

