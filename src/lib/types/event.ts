import { PublicUser } from "./user";

export interface Event {
	id: string;
	title: string;
	description: string;
	dateTime: Date;
	location: string;
	latitude: number | null;
	longitude: number | null;
	tags: string[];
	imageUrls: string[];
	createdAt: Date;
	updatedAt: Date;
	owner: PublicUser;
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

