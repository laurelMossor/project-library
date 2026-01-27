import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/image-attachments/:id
 * Remove an image attachment
 * Protected endpoint
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Find the attachment
		const attachment = await prisma.imageAttachment.findUnique({
			where: { id },
			include: {
				image: {
					select: { uploadedById: true },
				},
			},
		});

		if (!attachment) {
			return notFound("Image attachment not found");
		}

		// Verify ownership via the image
		if (attachment.image.uploadedById !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only remove your own image attachments" },
				{ status: 403 }
			);
		}

		await prisma.imageAttachment.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/image-attachments/:id error:", error);
		return serverError();
	}
}
