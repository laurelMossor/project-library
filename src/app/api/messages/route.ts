import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateMessageContent } from "@/lib/validations";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { logAction } from "@/lib/utils/server/log";

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

		let body: Record<string, string>;
		try {
			body = await request.json();
		} catch {
			return badRequest("Request body must be valid JSON");
		}
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

		// When asPageId is set, the conversation is owned by the page, not the user directly.
		// This ensures [page:PMG, user:Sam] conversations are separate from [user:Dolores, user:Sam].
		const senderParticipantWhere = asPageId
			? { pageId: asPageId }
			: { userId: ctx.userId };

		const senderParticipantCreate = asPageId
			? { pageId: asPageId }
			: { userId: ctx.userId };

		// Find existing conversation between these two participants
		let conversationId: string | null = null;

		const senderConversations = await prisma.conversationParticipant.findMany({
			where: senderParticipantWhere,
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

		const isNewConversation = conversationId === null;

		// If no existing conversation, create one with both participants
		if (!conversationId) {
			const conversation = await prisma.conversation.create({
				data: {
					participants: {
						create: [
							senderParticipantCreate,
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

		logAction("message.sent", ctx.userId, {
			conversationId,
			isNewConversation,
			asPageId: asPageId ?? undefined,
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
