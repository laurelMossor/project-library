import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";

type Params = { params: Promise<{ messageId: string }> };

/**
 * PATCH /api/messages/:messageId/read
 * Mark a message as read
 * Protected endpoint
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { messageId } = await params;

		// Find the message
		const message = await prisma.message.findUnique({ where: { id: messageId } });
		if (!message) {
			return notFound("Message not found");
		}

		// Only the receiver can mark as read
		if (message.receiverId !== ctx.activeOwnerId) {
			return NextResponse.json(
				{ error: "You can only mark your own received messages as read" },
				{ status: 403 }
			);
		}

		// Update readAt if not already set
		const updated = await prisma.message.update({
			where: { id: messageId },
			data: { readAt: message.readAt ?? new Date() },
		});

		return NextResponse.json({
			id: updated.id,
			readAt: updated.readAt,
		});
	} catch (error) {
		console.error("PATCH /api/messages/:messageId/read error:", error);
		return serverError();
	}
}
