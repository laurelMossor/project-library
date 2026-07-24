import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";
import { canManageAttachmentTarget, deleteAttachment } from "@/lib/utils/server/image-attachment";

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

		// Find the attachment (with its target and the image's uploader)
		const attachment = await prisma.imageAttachment.findUnique({
			where: { id },
			include: {
				image: {
					select: { uploadedByUserId: true },
				},
			},
		});

		if (!attachment) {
			return notFound("Image attachment not found");
		}

		// Allow removal by the image's uploader OR a manager of the target it's attached to (a page
		// ADMIN/EDITOR removing an image a member added, etc.) — not the uploader alone (finding #22).
		const isUploader = attachment.image.uploadedByUserId === ctx.userId;
		const managesTarget = isUploader
			? true
			: await canManageAttachmentTarget(ctx.userId, attachment.type, attachment.targetId);
		if (!isUploader && !managesTarget) {
			return NextResponse.json(
				{ error: "You can only remove image attachments you uploaded or manage" },
				{ status: 403 }
			);
		}

		// Removes the attachment AND its Image row + storage blob when nothing else
		// references the image (another attachment or a User/Page avatar) — see helper.
		await deleteAttachment(id);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/image-attachments/:id error:", error);
		return serverError();
	}
}
