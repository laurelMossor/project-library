import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { AttachmentTarget } from "@prisma/client";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { deleteImage } from "@/lib/utils/server/storage";

/**
 * POST /api/image-attachments
 * Attach an image to a target (Page, Event, Post, etc.)
 * Protected endpoint
 *
 * Body: { imageId: string, type: AttachmentTarget, targetId: string, sortOrder?: number }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { imageId, type, targetId, sortOrder, replace } = body;

		if (!imageId || typeof imageId !== "string") {
			return badRequest("imageId is required");
		}

		if (!type || !Object.values(AttachmentTarget).includes(type)) {
			return badRequest(`Valid type is required (${Object.values(AttachmentTarget).join(", ")})`);
		}

		if (!targetId || typeof targetId !== "string") {
			return badRequest("targetId is required");
		}

		// Verify image exists and belongs to user
		const image = await prisma.image.findUnique({ where: { id: imageId } });
		if (!image) {
			return notFound("Image not found");
		}

		if (image.uploadedByUserId !== ctx.userId) {
			return NextResponse.json(
				{ error: "You can only attach your own images" },
				{ status: 403 }
			);
		}

		// Verify target exists and user has permission
		if (type === AttachmentTarget.PAGE) {
			const page = await prisma.page.findUnique({ where: { id: targetId } });
			if (!page) return notFound("Page not found");
			const canEdit = await canPostAsPage(ctx.userId, targetId);
			if (!canEdit) {
				return NextResponse.json(
					{ error: "You don't have permission to attach images to this page" },
					{ status: 403 }
				);
			}
		} else if (type === AttachmentTarget.EVENT) {
			const event = await prisma.event.findUnique({ where: { id: targetId } });
			if (!event) return notFound("Event not found");
			if (event.userId !== ctx.userId) {
				return NextResponse.json(
					{ error: "You can only attach images to your own content" },
					{ status: 403 }
				);
			}
		} else if (type === AttachmentTarget.POST) {
			const post = await prisma.post.findUnique({ where: { id: targetId } });
			if (!post) return notFound("Post not found");
			if (post.userId !== ctx.userId) {
				return NextResponse.json(
					{ error: "You can only attach images to your own content" },
					{ status: 403 }
				);
			}
		} else {
			// MESSAGE / IMAGE (and any future target type) have no ownership path here —
			// default-deny so an image can't be injected onto a target the caller doesn't own.
			return NextResponse.json(
				{ error: "Unsupported attachment target" },
				{ status: 400 }
			);
		}

		// When replace=true, remove existing attachments for this target and delete their
		// images — but ONLY ones the caller owns, so swapping in a new cover can never
		// hard-delete another user's image (e.g. a co-host's upload on a page event).
		if (replace) {
			const existing = await prisma.imageAttachment.findMany({
				where: { type, targetId, image: { uploadedByUserId: ctx.userId } },
				include: { image: { select: { id: true, url: true } } },
			});
			const attachmentIds = existing.map((a) => a.id);
			const imageIds = existing.map((a) => a.image.id);
			await prisma.imageAttachment.deleteMany({ where: { id: { in: attachmentIds } } });
			await prisma.image.deleteMany({ where: { id: { in: imageIds } } });
			for (const att of existing) {
				const result = await deleteImage(att.image.url);
				if (result.error) {
					console.error(`Failed to delete replaced image ${att.image.id} from storage:`, result.error);
				}
			}
		}

		const attachment = await prisma.imageAttachment.create({
			data: {
				imageId,
				type,
				targetId,
				sortOrder: sortOrder ?? 0,
			},
		});

		return NextResponse.json(
			{
				id: attachment.id,
				imageId: attachment.imageId,
				type: attachment.type,
				targetId: attachment.targetId,
				sortOrder: attachment.sortOrder,
				createdAt: attachment.createdAt,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/image-attachments error:", error);
		return serverError();
	}
}
