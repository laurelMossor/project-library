import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { publicUserFields } from "@/lib/utils/server/user";
import { getPagesForUser } from "@/lib/utils/server/permission";

async function getAllConversationIds(userId: string): Promise<string[]> {
	const [directConvos, userPages] = await Promise.all([
		prisma.conversationParticipant.findMany({
			where: { userId },
			select: { conversationId: true },
		}),
		getPagesForUser(userId),
	]);

	const pageIds = userPages.map((p) => p.id);
	const pageConvos = pageIds.length > 0
		? await prisma.conversationParticipant.findMany({
			where: { pageId: { in: pageIds } },
			select: { conversationId: true },
		})
		: [];

	return [...new Set([
		...directConvos.map((p) => p.conversationId),
		...pageConvos.map((p) => p.conversationId),
	])];
}

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

		// Find conversation between current user (or their managed pages) and target
		const allConvIds = await getAllConversationIds(ctx.userId);

		let conversationId: string | null = null;

		if (allConvIds.length > 0) {
			const recipientInSameConv = await prisma.conversationParticipant.findFirst({
				where: {
					conversationId: { in: allConvIds },
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

/**
 * PATCH /api/messages/conversation/:targetId
 * Mark all unread messages in a conversation as read.
 * Protected endpoint — user must be a participant (directly or via managed page).
 */
export async function PATCH(_request: Request, { params }: Params) {
	try {
		const { targetId } = await params;

		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const allConvIds = await getAllConversationIds(ctx.userId);

		if (allConvIds.length === 0) return NextResponse.json({ updated: 0 });

		// Find the conversation that also has targetId as participant (user or page)
		const targetParticipant = await prisma.conversationParticipant.findFirst({
			where: {
				conversationId: { in: allConvIds },
				OR: [{ userId: targetId }, { pageId: targetId }],
			},
			select: { conversationId: true },
		});

		if (!targetParticipant) return notFound("Conversation not found");

		const { count } = await prisma.message.updateMany({
			where: {
				conversationId: targetParticipant.conversationId,
				senderId: { not: ctx.userId },
				readAt: null,
			},
			data: { readAt: new Date() },
		});

		return NextResponse.json({ updated: count });
	} catch (error) {
		console.error("PATCH /api/messages/conversation/:targetId error:", error);
		return serverError();
	}
}
