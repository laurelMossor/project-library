import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { publicUserFields } from "@/lib/utils/server/user";

interface Params {
	params: Promise<{ targetId: string }>;
}

/**
 * GET /api/messages/conversation/:targetId?type=user|page
 * Get messages in a conversation between the current user and a target user or page
 * Protected endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { targetId } = await params;

		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { searchParams } = new URL(request.url);
		const type = searchParams.get("type") || "user";

		if (type !== "user" && type !== "page") {
			return badRequest("Query param 'type' must be 'user' or 'page'");
		}

		// Build the target participant filter
		let targetParticipantWhere: { userId: string } | { pageId: string };
		let targetInfo: Record<string, unknown> | null = null;

		if (type === "user") {
			const targetUser = await prisma.user.findUnique({
				where: { id: targetId },
				select: publicUserFields,
			});
			if (!targetUser) {
				return notFound("User not found");
			}
			targetParticipantWhere = { userId: targetId };
			targetInfo = targetUser;
		} else {
			const targetPage = await prisma.page.findUnique({
				where: { id: targetId },
				select: {
					id: true,
					name: true,
					slug: true,
					avatarImageId: true,
				},
			});
			if (!targetPage) {
				return notFound("Page not found");
			}
			targetParticipantWhere = { pageId: targetId };
			targetInfo = targetPage;
		}

		// Find conversation between current user and target
		const senderConversations = await prisma.conversationParticipant.findMany({
			where: { userId: ctx.userId },
			select: { conversationId: true },
		});

		let conversationId: string | null = null;

		if (senderConversations.length > 0) {
			const senderConvIds = senderConversations.map((p) => p.conversationId);
			const recipientInSameConv = await prisma.conversationParticipant.findFirst({
				where: {
					conversationId: { in: senderConvIds },
					...targetParticipantWhere,
				},
				select: { conversationId: true },
			});

			if (recipientInSameConv) {
				conversationId = recipientInSameConv.conversationId;
			}
		}

		if (!conversationId) {
			// No conversation exists yet
			return NextResponse.json({
				messages: [],
				target: targetInfo,
				targetType: type,
			});
		}

		// Fetch messages in this conversation
		const messages = await prisma.message.findMany({
			where: { conversationId },
			include: {
				sender: {
					select: publicUserFields,
				},
			},
			orderBy: { createdAt: "asc" },
		});

		const transformedMessages = messages.map((m) => ({
			id: m.id,
			content: m.content,
			senderId: m.senderId,
			asPageId: m.asPageId,
			conversationId: m.conversationId,
			createdAt: m.createdAt,
			readAt: m.readAt,
			sender: m.sender,
		}));

		return NextResponse.json({
			messages: transformedMessages,
			target: targetInfo,
			targetType: type,
		});
	} catch (error) {
		console.error("GET /api/messages/conversation/:targetId error:", error);
		return serverError();
	}
}
