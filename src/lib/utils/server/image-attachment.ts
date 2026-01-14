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
 * Batch load images for multiple targets (fixes N+1 query problem)
 * Returns a map of targetId -> ImageItem[]
 */
export async function getImagesForTargetsBatch(
	type: AttachmentType,
	targetIds: string[]
): Promise<Map<string, ImageItem[]>> {
	if (targetIds.length === 0) {
		return new Map();
	}

	const attachments = await prisma.imageAttachment.findMany({
		where: {
			type,
			targetId: { in: targetIds },
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

	// Group by targetId
	const imageMap = new Map<string, ImageItem[]>();
	for (const targetId of targetIds) {
		imageMap.set(targetId, []);
	}

	for (const attachment of attachments) {
		const existing = imageMap.get(attachment.targetId) || [];
		existing.push(attachment.image as ImageItem);
		imageMap.set(attachment.targetId, existing);
	}

	return imageMap;
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

