import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { publicUserFields } from "@/lib/utils/server/user";

/**
 * GET /api/messages/inbox
 * List conversations the user participates in (directly or via page membership)
 * Returns conversation summaries with last message
 * Protected endpoint
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		// Get page IDs the user has access to
		const userPages = await getPagesForUser(ctx.userId);
		const pageIds = userPages.map((p) => p.id);

		// Find all conversations the user participates in
		// Either directly as a user, or via a page they manage
		const participantRecords = await prisma.conversationParticipant.findMany({
			where: {
				OR: [
					{ userId: ctx.userId },
					...(pageIds.length > 0 ? [{ pageId: { in: pageIds } }] : []),
				],
			},
			select: { conversationId: true },
		});

		const conversationIds = [...new Set(participantRecords.map((p) => p.conversationId))];

		if (conversationIds.length === 0) {
			return NextResponse.json([]);
		}

		// Fetch conversations with participants and last message
		const conversations = await prisma.conversation.findMany({
			where: { id: { in: conversationIds } },
			include: {
				participants: {
					include: {
						user: {
							select: publicUserFields,
						},
						page: {
							select: {
								id: true,
								name: true,
								slug: true,
								avatarImageId: true,
							},
						},
					},
				},
				messages: {
					orderBy: { createdAt: "desc" },
					take: 1,
					include: {
						sender: {
							select: publicUserFields,
						},
					},
				},
			},
			orderBy: { updatedAt: "desc" },
			take: 50,
		});

		const conversationSummaries = conversations.map((conv) => ({
			id: conv.id,
			updatedAt: conv.updatedAt,
			participants: conv.participants.map((p) => ({
				id: p.id,
				user: p.user,
				page: p.page,
			})),
			lastMessage: conv.messages[0]
				? {
						id: conv.messages[0].id,
						content: conv.messages[0].content,
						senderId: conv.messages[0].senderId,
						asPageId: conv.messages[0].asPageId,
						createdAt: conv.messages[0].createdAt,
						readAt: conv.messages[0].readAt,
						sender: conv.messages[0].sender,
				  }
				: null,
		}));

		return NextResponse.json(conversationSummaries);
	} catch (error) {
		console.error("GET /api/messages/inbox error:", error);
		return serverError();
	}
}
