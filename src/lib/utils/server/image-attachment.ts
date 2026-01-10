// ⚠️ SERVER-ONLY: Image attachment utilities
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ImageItem, AttachmentType } from "../../types/image";
import { imageFields } from "./fields";

/**
 * Attach an image to a target (project, event, or post)
 */
export async function attachImage(
	imageId: string,
	type: AttachmentType,
	targetId: string,
	sortOrder: number = 0
) {
	return prisma.imageAttachment.create({
		data: {
			imageId,
			type,
			targetId,
			sortOrder,
		},
		include: {
			image: {
				select: imageFields,
			},
		},
	});
}

/**
 * Get all images attached to a target
 */
export async function getImagesForTarget(
	type: AttachmentType,
	targetId: string
): Promise<ImageItem[]> {
	const attachments = await prisma.imageAttachment.findMany({
		where: {
			type,
			targetId,
		},
		include: {
			image: {
				select: imageFields,
			},
		},
		orderBy: {
			sortOrder: "asc",
		},
	});
	
	return attachments.map(att => att.image) as ImageItem[];
}

/**
 * Remove an image attachment
 */
export async function detachImage(imageId: string, targetId: string): Promise<void> {
	await prisma.imageAttachment.deleteMany({
		where: {
			imageId,
			targetId,
		},
	});
}

/**
 * Remove all image attachments for a target
 */
export async function detachAllImagesForTarget(
	type: AttachmentType,
	targetId: string
): Promise<void> {
	await prisma.imageAttachment.deleteMany({
		where: {
			type,
			targetId,
		},
	});
}

/**
 * Update sort order for an image attachment
 */
export async function updateImageAttachmentSortOrder(
	attachmentId: string,
	sortOrder: number
) {
	return prisma.imageAttachment.update({
		where: { id: attachmentId },
		data: { sortOrder },
	});
}

