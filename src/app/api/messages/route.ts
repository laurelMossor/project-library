import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateMessageContent } from "@/lib/validations";
import { canPostAsPage } from "@/lib/utils/server/permission";

/**
 * POST /api/messages
 * Send a message (creates or finds existing conversation)
 * Protected endpoint
 *
 * Body: { recipientUserId?: string, recipientPageId?: string, content: string, asPageId?: string }
 * Exactly one of recipientUserId or recipientPageId must be provided.
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { recipientUserId, recipientPageId, content, asPageId } = body;

		// Validate content
		const contentValidation = validateMessageContent(content);
		if (!contentValidation.valid) {
			return badRequest(contentValidation.error || "Invalid message content");
		}

		// Exactly one recipient type must be provided
		if ((!recipientUserId && !recipientPageId) || (recipientUserId && recipientPageId)) {
			return badRequest("Exactly one of recipientUserId or recipientPageId must be provided");
		}

		// Can't message yourself
		if (recipientUserId && recipientUserId === ctx.userId) {
			return badRequest("Cannot send a message to yourself");
		}

		// If asPageId, verify user has permission to post as this page
		if (asPageId) {
			const allowed = await canPostAsPage(ctx.userId, asPageId);
			if (!allowed) {
				return badRequest("You don't have permission to send as this page");
			}
		}

		// Build participant criteria for finding/creating conversation
		// Sender participant: the current user (direct user participant)
		// Recipient participant: either a user or a page
		let recipientParticipantWhere: { userId: string } | { pageId: string };

		if (recipientUserId) {
			// Verify recipient user exists
			const recipientUser = await prisma.user.findUnique({ where: { id: recipientUserId } });
			if (!recipientUser) {
				return notFound("Recipient user not found");
			}
			recipientParticipantWhere = { userId: recipientUserId };
		} else {
			// Verify recipient page exists
			const recipientPage = await prisma.page.findUnique({ where: { id: recipientPageId } });
			if (!recipientPage) {
				return notFound("Recipient page not found");
			}
			recipientParticipantWhere = { pageId: recipientPageId };
		}

		// Find existing conversation between these two participants
		// A conversation where BOTH the sender (as user) and the recipient are participants
		let conversationId: string | null = null;

		const senderConversations = await prisma.conversationParticipant.findMany({
			where: { userId: ctx.userId },
			select: { conversationId: true },
		});

		if (senderConversations.length > 0) {
			const senderConvIds = senderConversations.map((p) => p.conversationId);

			const recipientInSameConv = await prisma.conversationParticipant.findFirst({
				where: {
					conversationId: { in: senderConvIds },
					...recipientParticipantWhere,
				},
				select: { conversationId: true },
			});

			if (recipientInSameConv) {
				conversationId = recipientInSameConv.conversationId;
			}
		}

		// If no existing conversation, create one with both participants
		if (!conversationId) {
			const conversation = await prisma.conversation.create({
				data: {
					participants: {
						create: [
							{ userId: ctx.userId },
							recipientUserId
								? { userId: recipientUserId }
								: { pageId: recipientPageId },
						],
					},
				},
			});
			conversationId = conversation.id;
		}

		// Create the message
		const message = await prisma.message.create({
			data: {
				conversationId,
				senderId: ctx.userId,
				content: content.trim(),
				asPageId: asPageId || null,
			},
		});

		// Update conversation updatedAt
		await prisma.conversation.update({
			where: { id: conversationId },
			data: { updatedAt: new Date() },
		});

		return NextResponse.json(
			{
				id: message.id,
				conversationId: message.conversationId,
				senderId: message.senderId,
				asPageId: message.asPageId,
				content: message.content,
				createdAt: message.createdAt,
				readAt: message.readAt,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/messages error:", error);
		return serverError();
	}
}
