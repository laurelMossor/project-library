import { PublicUser } from "./user";

export interface Project {
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