import { BaseCollectionItem } from "./collection-base";

/**
 * Project type - matches Prisma schema
 * Extends BaseCollectionItem with project-specific fields
 * The 'type' field is stored in the database as a discriminator for collection handling
 */
export interface ProjectItem extends BaseCollectionItem {
	type: "project";
	imageUrl: string | null;
	updatedAt: Date;
}

export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
	imageUrl?: string; // optional image URL/path
}