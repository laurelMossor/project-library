// ⚠️ SERVER-ONLY: Image attachment utilities
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ImageItem } from "../../types/image";
import { AttachmentTarget } from "@prisma/client";
import { imageFields } from "./fields";
import { canManageEntity } from "./permission";

/**
 * Can `userId` manage the entity an attachment points at? Resolves the (type, targetId) pair to
 * its owning user/page and defers to `canManageEntity` (author, or ADMIN/EDITOR of the page).
 * IMAGE / MESSAGE targets have no ownership path here → false. Used to authorize attachment
 * mutations by the *target's* manager, not just the image's uploader.
 */
export async function canManageAttachmentTarget(
	userId: string,
	type: AttachmentTarget,
	targetId: string,
): Promise<boolean> {
	switch (type) {
		case AttachmentTarget.PAGE:
			return canManageEntity(userId, { page: { id: targetId } });
		case AttachmentTarget.EVENT: {
			const event = await prisma.event.findUnique({ where: { id: targetId }, select: { userId: true, pageId: true } });
			if (!event) return false;
			return event.pageId
				? canManageEntity(userId, { page: { id: event.pageId } })
				: canManageEntity(userId, { user: { id: event.userId } });
		}
		case AttachmentTarget.POST: {
			const post = await prisma.post.findUnique({ where: { id: targetId }, select: { userId: true, pageId: true } });
			if (!post) return false;
			return post.pageId
				? canManageEntity(userId, { page: { id: post.pageId } })
				: canManageEntity(userId, { user: { id: post.userId } });
		}
		default:
			return false;
	}
}

/**
 * Attach an image to a target (page, event, or post)
 */
export async function attachImage(
	imageId: string,
	type: AttachmentTarget,
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
	type: AttachmentTarget,
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

	return attachments.map(att => ({ ...att.image, attachmentId: att.id })) as ImageItem[];
}

/**
 * Batch load images for multiple targets (fixes N+1 query problem)
 * Returns a map of targetId -> ImageItem[]
 */
export async function getImagesForTargetsBatch(
	type: AttachmentTarget,
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
		existing.push({ ...attachment.image, attachmentId: attachment.id } as ImageItem);
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
	type: AttachmentTarget,
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
