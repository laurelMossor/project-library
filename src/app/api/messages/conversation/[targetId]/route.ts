import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { publicUserFields } from "@/lib/utils/server/user";
import { canPostAsPage } from "@/lib/utils/server/permission";

/**
 * Returns conversation IDs for a specific identity.
 * When asPageId is provided, returns only that page's conversations.
 * Otherwise returns only the user's direct conversations.
 */
async function getConversationIdsForIdentity(
	userId: string,
	asPageId: string | null,
): Promise<string[]> {
	const where = asPageId
		? { pageId: asPageId }
		: { userId };

	const records = await prisma.conversationParticipant.findMany({
		where,
		select: { conversationId: true },
	});

	return records.map((p) => p.conversationId);
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
		const asPageId = searchParams.get("asPageId") || null;

		if (type !== "user" && type !== "page") {
			return badRequest("Query param 'type' must be 'user' or 'page'");
		}

		// If acting as a page, verify permission
		if (asPageId) {
			const allowed = await canPostAsPage(ctx.userId, asPageId);
			if (!allowed) {
				return badRequest("You don't have permission to act as this page");
			}
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

		// Find conversation between the active identity and the target
		const identityConvIds = await getConversationIdsForIdentity(ctx.userId, asPageId);

		let conversationId: string | null = null;

		if (identityConvIds.length > 0) {
			const recipientInSameConv = await prisma.conversationParticipant.findFirst({
				where: {
					conversationId: { in: identityConvIds },
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
export async function PATCH(request: Request, { params }: Params) {
	try {
		const { targetId } = await params;

		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		// Read asPageId from request body (optional)
		let asPageId: string | null = null;
		try {
			const body = await request.json();
			asPageId = body.asPageId ?? null;
		} catch {
			// No body is fine — defaults to personal identity
		}

		const identityConvIds = await getConversationIdsForIdentity(ctx.userId, asPageId);

		if (identityConvIds.length === 0) return NextResponse.json({ updated: 0 });

		// Find the conversation that also has targetId as participant (user or page)
		const targetParticipant = await prisma.conversationParticipant.findFirst({
			where: {
				conversationId: { in: identityConvIds },
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
