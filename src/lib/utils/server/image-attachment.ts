// ⚠️ SERVER-ONLY: Image attachment utilities
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ImageItem } from "../../types/image";
import { AttachmentTarget } from "@prisma/client";
import { imageFields } from "./fields";
import { canActAsEntity } from "./permission";
import { deleteImage } from "./storage";

/**
 * Can `userId` manage the entity an attachment points at? Resolves the (type, targetId) pair to
 * its owning user/page and defers to `canActAsEntity` (author, or ADMIN/EDITOR of the page).
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
			return canActAsEntity(userId, { page: { id: targetId } });
		case AttachmentTarget.EVENT: {
			const event = await prisma.event.findUnique({ where: { id: targetId }, select: { userId: true, pageId: true } });
			if (!event) return false;
			return event.pageId
				? canActAsEntity(userId, { page: { id: event.pageId } })
				: canActAsEntity(userId, { user: { id: event.userId } });
		}
		case AttachmentTarget.POST: {
			const post = await prisma.post.findUnique({ where: { id: targetId }, select: { userId: true, pageId: true } });
			if (!post) return false;
			return post.pageId
				? canActAsEntity(userId, { page: { id: post.pageId } })
				: canActAsEntity(userId, { user: { id: post.userId } });
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
 * Hard-delete an Image row + its storage blob, but ONLY if nothing else references it.
 *
 * One Image can back multiple ImageAttachments and/or a User/Page avatar FK. Because
 * ImageAttachment.imageId is `onDelete: Cascade` and avatar FKs are `onDelete: SetNull`,
 * deleting a still-referenced Image would silently drop another attachment or null an
 * avatar. So we count remaining references first and skip the delete when shared. Call
 * this AFTER removing the attachment(s) so the count reflects the post-detach state.
 *
 * Storage deletion is best-effort (Supabase-only; dev `/uploads/` paths fail the URL
 * check and are logged, not thrown) — matches the rest of the delete paths.
 */
async function deleteImageIfOrphaned(imageId: string, url: string): Promise<void> {
	const [attachments, userAvatars, pageAvatars] = await Promise.all([
		prisma.imageAttachment.count({ where: { imageId } }),
		prisma.user.count({ where: { avatarImageId: imageId } }),
		prisma.page.count({ where: { avatarImageId: imageId } }),
	]);
	if (attachments || userAvatars || pageAvatars) return; // still referenced → keep
	await prisma.image.delete({ where: { id: imageId } });
	const result = await deleteImage(url);
	if (!result.success) {
		console.error(`Failed to delete image ${imageId} from storage:`, result.error);
	}
}

/**
 * Remove a single attachment (by id) and clean up its now-orphaned Image + blob.
 * The one true "detach a photo" path — use this instead of a bare imageAttachment.delete
 * so images/blobs don't leak.
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
	const attachment = await prisma.imageAttachment.findUnique({
		where: { id: attachmentId },
		include: { image: { select: { id: true, url: true } } },
	});
	if (!attachment) return;
	await prisma.imageAttachment.delete({ where: { id: attachmentId } });
	await deleteImageIfOrphaned(attachment.image.id, attachment.image.url);
}

/**
 * Remove all attachments for a target and clean up their orphaned Images + blobs.
 * `onlyUploadedBy` scopes to the caller's own uploads (used by the replace-cover flow so
 * swapping a cover never hard-deletes a co-host's image). Omit it when the whole target
 * is going away (event/post deletion) so every attached image is cleaned up.
 */
export async function deleteAllAttachmentsForTarget(
	type: AttachmentTarget,
	targetId: string,
	opts?: { onlyUploadedBy?: string }
): Promise<void> {
	const attachments = await prisma.imageAttachment.findMany({
		where: {
			type,
			targetId,
			...(opts?.onlyUploadedBy ? { image: { uploadedByUserId: opts.onlyUploadedBy } } : {}),
		},
		include: { image: { select: { id: true, url: true } } },
	});
	if (attachments.length === 0) return;
	await prisma.imageAttachment.deleteMany({ where: { id: { in: attachments.map((a) => a.id) } } });
	for (const att of attachments) {
		await deleteImageIfOrphaned(att.image.id, att.image.url);
	}
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
