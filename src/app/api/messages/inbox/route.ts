import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { getConversationIdsForIdentity } from "@/lib/utils/server/message";
import { publicUserEmbedFields } from "@/lib/utils/server/user";

/**
 * GET /api/messages/inbox?asPageId=<id>
 * List conversations for the ACTIVE identity: personal (no asPageId) or a single page the caller
 * manages. Returns conversation summaries with last message. Protected endpoint.
 */
export async function GET(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const asPageId = new URL(request.url).searchParams.get("asPageId") || null;

		// Acting as a page is verified from the session (ADMIN/EDITOR), never trusted from the query.
		if (asPageId) {
			const allowed = await canPostAsPage(ctx.userId, asPageId);
			if (!allowed) {
				return badRequest("You don't have permission to act as this page");
			}
		}

		// Scope to the active identity only: a personal inbox never shows page conversations and a
		// page inbox never shows personal ones. Replaces the old client-side filter (findings #16/#25).
		const conversationIds = await getConversationIdsForIdentity(ctx.userId, asPageId);

		if (conversationIds.length === 0) {
			return NextResponse.json([]);
		}

		// Fetch conversations with participants and last message
		// Filter to conversations that have at least one message (empty conversations shouldn't appear in inbox)
		const conversations = await prisma.conversation.findMany({
			where: { id: { in: conversationIds }, messages: { some: {} } },
			include: {
				participants: {
					include: {
						user: {
							select: publicUserEmbedFields,
						},
						page: {
							select: {
								id: true,
								name: true,
								handle: true,
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
							select: publicUserEmbedFields,
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
