// ⚠️ SERVER-ONLY: Reusable field selection objects for Prisma queries
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { publicUserFields } from "./user";

/**
 * Standard fields to select when fetching an image
 * Includes all image metadata needed for display
 */
export const imageFields = {
	id: true,
	url: true,
	path: true,
	altText: true,
	projectId: true,
	eventId: true,
	uploadedById: true,
	createdAt: true,
} as const;

/**
 * Standard fields to select when fetching images relation
 * Use this in select statements for images arrays
 */
export const imagesRelationFields = {
	select: imageFields,
} as const;

/**
 * Base fields for Project model (without relations)
 */
export const projectBaseFields = {
	id: true,
	type: true,
	title: true,
	description: true,
	tags: true,
	createdAt: true,
	updatedAt: true,
} as const;

/**
 * Standard fields to select when fetching a project with owner and images
 * Composable: uses projectBaseFields, imagesRelationFields, and publicUserFields
 */
export const projectWithOwnerFields = {
	...projectBaseFields,
	images: imagesRelationFields,
	owner: {
		select: publicUserFields,
	},
} as const;

/**
 * Base fields for Event model (without relations)
 */
export const eventBaseFields = {
	id: true,
	type: true,
	title: true,
	description: true,
	dateTime: true,
	location: true,
	latitude: true,
	longitude: true,
	tags: true,
	createdAt: true,
	updatedAt: true,
} as const;

/**
 * Standard fields to select when fetching an event with owner and images
 * Composable: uses eventBaseFields, imagesRelationFields, and publicUserFields
 */
export const eventWithOwnerFields = {
	...eventBaseFields,
	images: imagesRelationFields,
	owner: {
		select: publicUserFields,
	},
} as const;

