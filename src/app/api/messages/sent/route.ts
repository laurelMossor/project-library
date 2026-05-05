import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";
import { publicUserFields } from "@/lib/utils/server/user";

/**
 * GET /api/messages/sent
 * Get messages sent by the current user
 * Protected endpoint
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const messages = await prisma.message.findMany({
			where: { senderId: ctx.userId },
			include: {
				conversation: {
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
										handle: true,
										avatarImageId: true,
									},
								},
							},
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		const messagesList = messages.map((m) => ({
			id: m.id,
			senderId: m.senderId,
			asPageId: m.asPageId,
			conversationId: m.conversationId,
			content: m.content,
			createdAt: m.createdAt,
			readAt: m.readAt,
			participants: m.conversation.participants
				.filter((p) => p.userId !== ctx.userId)
				.map((p) => ({
					user: p.user,
					page: p.page,
				})),
		}));

		return NextResponse.json(messagesList);
	} catch (error) {
		console.error("GET /api/messages/sent error:", error);
		return serverError();
	}
}
