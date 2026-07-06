import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { publicUserEmbedFields } from "@/lib/utils/server/user";

/**
 * GET /api/messages/sent?asPageId=<id>
 * Messages the current user sent AS the active identity — personal (asPageId=null) or a single
 * managed page. Scoped server-side so a page's sent messages don't bleed into the personal view
 * (findings #16/#25). Protected endpoint.
 */
export async function GET(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const asPageId = new URL(request.url).searchParams.get("asPageId") || null;
		if (asPageId) {
			const allowed = await canPostAsPage(ctx.userId, asPageId);
			if (!allowed) {
				return badRequest("You don't have permission to act as this page");
			}
		}

		const messages = await prisma.message.findMany({
			where: { senderId: ctx.userId, asPageId },
			include: {
				conversation: {
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
