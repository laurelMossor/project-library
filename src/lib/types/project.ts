import { PublicUser } from "./user";

/**
 * Project type - matches Prisma schema
 * The 'type' field is stored in the database as a discriminator for collection handling
 */
export interface Project {
	type: "project";
	id: string;
	title: string;
	description: string;
	tags: string[];
	imageUrl: string | null;
	createdAt: Date;
	updatedAt: Date;
	owner: PublicUser;
}

export interface ProjectData {
	title: string;
	description: string;
	tags?: string[];
	imageUrl?: string; // optional image URL/path
}