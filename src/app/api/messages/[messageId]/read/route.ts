import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";
import { getPagesForUser } from "@/lib/utils/server/permission";

type Params = { params: Promise<{ messageId: string }> };

/**
 * PATCH /api/messages/:messageId/read
 * Mark a message as read
 * Protected endpoint
 *
 * User must be a participant in the conversation (directly or via page membership).
 * Only non-sender participants can mark a message as read.
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { messageId } = await params;

		// Find the message with its conversation participants
		const message = await prisma.message.findUnique({
			where: { id: messageId },
			include: {
				conversation: {
					include: {
						participants: {
							select: { userId: true, pageId: true },
						},
					},
				},
			},
		});

		if (!message) {
			return notFound("Message not found");
		}

		// Sender can't mark their own message as read
		if (message.senderId === ctx.userId) {
			return NextResponse.json(
				{ error: "Cannot mark your own message as read" },
				{ status: 403 }
			);
		}

		// Check that user is a participant (directly or via page)
		const participants = message.conversation.participants;
		const isDirectParticipant = participants.some((p) => p.userId === ctx.userId);

		let isPageParticipant = false;
		if (!isDirectParticipant) {
			const pageParticipantIds = participants
				.filter((p) => p.pageId !== null)
				.map((p) => p.pageId as string);

			if (pageParticipantIds.length > 0) {
				const userPages = await getPagesForUser(ctx.userId);
				const userPageIds = new Set(userPages.map((p) => p.id));
				isPageParticipant = pageParticipantIds.some((pid) => userPageIds.has(pid));
			}
		}

		if (!isDirectParticipant && !isPageParticipant) {
			return NextResponse.json(
				{ error: "You are not a participant in this conversation" },
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
