import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { ArtifactType } from "@prisma/client";

/**
 * POST /api/image-attachments
 * Attach an image to an artifact (Project, Event, or Post)
 * Protected endpoint
 * 
 * Body: { imageId: string, type: ArtifactType, targetId: string, sortOrder?: number }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { imageId, type, targetId, sortOrder } = body;

		if (!imageId || typeof imageId !== "string") {
			return badRequest("imageId is required");
		}

		if (!type || !Object.values(ArtifactType).includes(type)) {
			return badRequest("Valid type is required (PROJECT, EVENT, or POST)");
		}

		if (!targetId || typeof targetId !== "string") {
			return badRequest("targetId is required");
		}

		// Verify image exists and belongs to user
		const image = await prisma.image.findUnique({ where: { id: imageId } });
		if (!image) {
			return notFound("Image not found");
		}

		if (image.uploadedById !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only attach your own images" },
				{ status: 403 }
			);
		}

		// Verify target exists and belongs to user
		let targetOwnerId: string | null = null;

		if (type === ArtifactType.PROJECT) {
			const project = await prisma.project.findUnique({ where: { id: targetId } });
			if (!project) return notFound("Project not found");
			targetOwnerId = project.ownerId;
		} else if (type === ArtifactType.EVENT) {
			const event = await prisma.event.findUnique({ where: { id: targetId } });
			if (!event) return notFound("Event not found");
			targetOwnerId = event.ownerId;
		} else if (type === ArtifactType.POST) {
			const post = await prisma.post.findUnique({ where: { id: targetId } });
			if (!post) return notFound("Post not found");
			targetOwnerId = post.ownerId;
		}

		if (targetOwnerId !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only attach images to your own content" },
				{ status: 403 }
			);
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
