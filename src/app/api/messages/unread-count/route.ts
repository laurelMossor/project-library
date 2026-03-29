import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/messages/unread-count
 * Returns the total number of unread messages across all conversations
 * the user participates in (directly or via managed pages).
 * Protected endpoint.
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		// Collect conversation IDs the user participates in directly
		const directConvIds = await prisma.conversationParticipant.findMany({
			where: { userId: ctx.userId },
			select: { conversationId: true },
		});

		// Collect conversation IDs via pages the user manages
		const pagePerms = await prisma.permission.findMany({
			where: { userId: ctx.userId, resourceType: "PAGE", role: { in: ["ADMIN", "EDITOR"] } },
			select: { resourceId: true },
		});
		const pageIds = pagePerms.map((p) => p.resourceId);

		const pageConvIds = pageIds.length > 0
			? await prisma.conversationParticipant.findMany({
				where: { pageId: { in: pageIds } },
				select: { conversationId: true },
			})
			: [];

		const allConvIds = [
			...new Set([
				...directConvIds.map((c) => c.conversationId),
				...pageConvIds.map((c) => c.conversationId),
			]),
		];

		if (allConvIds.length === 0) return NextResponse.json({ count: 0 });

		const count = await prisma.message.count({
			where: {
				conversationId: { in: allConvIds },
				senderId: { not: ctx.userId },
				readAt: null,
			},
		});

		return NextResponse.json({ count });
	} catch (error) {
		console.error("GET /api/messages/unread-count error:", error);
		return serverError();
	}
}
