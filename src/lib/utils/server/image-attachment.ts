// ⚠️ SERVER-ONLY: Image attachment utilities
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { ImageItem } from "../../types/image";
import { AttachmentTarget, type Prisma } from "@prisma/client";
import { imageFields } from "./fields";
import { canActAsEntity, canEditContent } from "./permission";
import { removeStoragePaths } from "./storage";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Persist an Image row for an already-uploaded blob. The single owner of Image-row creation,
 * shared by the upload route (session user) and the Telegram webhook (attributed to the
 * Poster Catcher author user id). Pair with `storeImageBytes`/`uploadImage*` which upload the blob.
 */
export async function createImage(input: {
	url: string;
	path: string;
	uploadedByUserId: string;
	altText?: string | null;
	caption?: string | null;
}) {
	return prisma.image.create({
		data: {
			url: input.url,
			path: input.path,
			uploadedByUserId: input.uploadedByUserId,
			altText: input.altText ?? null,
			caption: input.caption ?? null,
		},
	});
}

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
			const event = await prisma.event.findUnique({ where: { id: targetId }, select: { userId: true, pageId: true, asPageId: true } });
			if (!event) return false;
			return canEditContent(userId, event);
		}
		case AttachmentTarget.POST: {
			const post = await prisma.post.findUnique({ where: { id: targetId }, select: { userId: true, pageId: true, asPageId: true } });
			if (!post) return false;
			return canEditContent(userId, post);
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
 * Delete Image rows among `imageIds` that nothing still points at (no attachment, no
 * user or page avatar) and return their storage paths. Call after the referencing rows
 * are gone. The caller removes the blobs — immediately for a single detach, or after
 * commit when this runs inside a larger transaction.
 */
export async function collectOrphanedImages(imageIds: string[], tx: Db = prisma): Promise<string[]> {
	const ids = [...new Set(imageIds.filter(Boolean))];
	if (ids.length === 0) return [];
	const [attachments, userAvatars, pageAvatars] = await Promise.all([
		tx.imageAttachment.findMany({ where: { imageId: { in: ids } }, select: { imageId: true } }),
		tx.user.findMany({ where: { avatarImageId: { in: ids } }, select: { avatarImageId: true } }),
		tx.page.findMany({ where: { avatarImageId: { in: ids } }, select: { avatarImageId: true } }),
	]);
	const referenced = new Set<string>();
	for (const row of attachments) referenced.add(row.imageId);
	for (const row of userAvatars) if (row.avatarImageId) referenced.add(row.avatarImageId);
	for (const row of pageAvatars) if (row.avatarImageId) referenced.add(row.avatarImageId);
	const orphanIds = ids.filter((id) => !referenced.has(id));
	if (orphanIds.length === 0) return [];
	const orphans = await tx.image.findMany({ where: { id: { in: orphanIds } }, select: { path: true } });
	await tx.image.deleteMany({ where: { id: { in: orphanIds } } });
	return orphans.map((image) => image.path);
}

/** Detach every attachment on the given targets. Returns storage paths of images that became orphaned. */
export async function detachAllForTargets(
	targets: { type: AttachmentTarget; targetId: string }[],
	tx: Db,
): Promise<string[]> {
	if (targets.length === 0) return [];
	const attachments = await tx.imageAttachment.findMany({
		where: { OR: targets.map((target) => ({ type: target.type, targetId: target.targetId })) },
		select: { id: true, imageId: true },
	});
	if (attachments.length === 0) return [];
	await tx.imageAttachment.deleteMany({ where: { id: { in: attachments.map((a) => a.id) } } });
	return collectOrphanedImages(attachments.map((a) => a.imageId), tx);
}

/**
 * Remove a single attachment (by id) and clean up its now-orphaned Image + blob.
 * The one true "detach a photo" path — use this instead of a bare imageAttachment.delete
 * so images/blobs don't leak.
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
	const attachment = await prisma.imageAttachment.findUnique({
		where: { id: attachmentId },
		select: { imageId: true },
	});
	if (!attachment) return;
	await prisma.imageAttachment.delete({ where: { id: attachmentId } });
	await removeStoragePaths(await collectOrphanedImages([attachment.imageId]));
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
		select: { id: true, imageId: true },
	});
	if (attachments.length === 0) return;
	await prisma.imageAttachment.deleteMany({ where: { id: { in: attachments.map((a) => a.id) } } });
	await removeStoragePaths(await collectOrphanedImages(attachments.map((a) => a.imageId)));
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
