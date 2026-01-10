// ⚠️ SERVER-ONLY: Reusable field selection objects for Prisma queries
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { publicUserFields } from "./user";

/**
 * Standard fields to select when fetching an image
 * Includes all image metadata needed for display
 * Note: projectId/eventId removed in v2 - use ImageAttachment instead
 */
export const imageFields = {
	id: true,
	url: true,
	path: true,
	altText: true,
	uploadedById: true,
	createdAt: true,
} as const;

/**
 * Standard fields to select when fetching an image attachment
 */
export const imageAttachmentFields = {
	id: true,
	imageId: true,
	type: true,
	targetId: true,
	sortOrder: true,
	createdAt: true,
} as const;

/**
 * Standard fields to select when fetching images via ImageAttachment
 * Note: Images are no longer directly related - use getImagesForTarget() helper instead
 * This is kept for backward compatibility but should be replaced
 */
export const imagesRelationFields = {
	select: imageFields,
} as const;


/**
 * Base fields for Project model (without relations)
 * Note: type field removed in v2 - derived in TypeScript
 */
export const projectBaseFields = {
	id: true,
	title: true,
	description: true,
	tags: true,
	createdAt: true,
	updatedAt: true,
} as const;

/**
 * Standard fields to select when fetching a project with owner
 * Note: Images are loaded separately via ImageAttachment - use getImagesForTarget("PROJECT", id)
 * Composable: uses projectBaseFields and publicUserFields
 * Note: owner is now through Actor relation
 */
export const projectWithOwnerFields = {
	...projectBaseFields,
	// Images removed - load separately via ImageAttachment
	owner: {
		select: {
			id: true,
			type: true,
			user: {
				select: publicUserFields,
			},
			org: {
				select: {
					id: true,
					name: true,
					slug: true,
					headline: true,
					bio: true,
					interests: true,
					location: true,
					avatarImageId: true,
				},
			},
		},
	},
} as const;

/**
 * Base fields for Event model (without relations)
 * Note: type field removed in v2 - derived in TypeScript
 */
export const eventBaseFields = {
	id: true,
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
 * Standard fields to select when fetching an event with owner
 * Note: Images are loaded separately via ImageAttachment - use getImagesForTarget("EVENT", id)
 * Composable: uses eventBaseFields and publicUserFields
 * Note: owner is now through Actor relation
 */
export const eventWithOwnerFields = {
	...eventBaseFields,
	// Images removed - load separately via ImageAttachment
	owner: {
		select: {
			id: true,
			type: true,
			user: {
				select: publicUserFields,
			},
			org: {
				select: {
					id: true,
					name: true,
					slug: true,
					headline: true,
					bio: true,
					interests: true,
					location: true,
					avatarImageId: true,
				},
			},
		},
	},
} as const;

