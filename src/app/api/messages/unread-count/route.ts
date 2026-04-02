import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/messages/unread-count
 * Returns unread message counts split by active profile:
 *   { personal: number, pages: { [pageId]: number } }
 * Protected endpoint.
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		// Personal: conversations where the user is a direct participant
		const directParticipants = await prisma.conversationParticipant.findMany({
			where: { userId: ctx.userId },
			select: { conversationId: true },
		});
		const directConvIds = directParticipants.map((p) => p.conversationId);

		const personal = directConvIds.length > 0
			? await prisma.message.count({
				where: {
					conversationId: { in: directConvIds },
					senderId: { not: ctx.userId },
					readAt: null,
				},
			})
			: 0;

		// Pages: one unread count per managed page
		const pagePerms = await prisma.permission.findMany({
			where: { userId: ctx.userId, resourceType: "PAGE", role: { in: ["ADMIN", "EDITOR"] } },
			select: { resourceId: true },
		});
		const pageIds = pagePerms.map((p) => p.resourceId);

		const pagesResult: Record<string, number> = {};

		if (pageIds.length > 0) {
			// Fetch conversation participants for all managed pages in one query
			const pageParticipants = await prisma.conversationParticipant.findMany({
				where: { pageId: { in: pageIds } },
				select: { conversationId: true, pageId: true },
			});

			// Group conversation IDs by page
			const convsByPage: Record<string, string[]> = {};
			for (const { pageId, conversationId } of pageParticipants) {
				if (!pageId) continue;
				(convsByPage[pageId] ??= []).push(conversationId);
			}

			// Count unread per page
			await Promise.all(
				pageIds.map(async (pageId) => {
					const convIds = convsByPage[pageId] ?? [];
					pagesResult[pageId] = convIds.length > 0
						? await prisma.message.count({
							where: {
								conversationId: { in: convIds },
								senderId: { not: ctx.userId },
								readAt: null,
							},
						})
						: 0;
				})
			);
		}

		return NextResponse.json({ personal, pages: pagesResult });
	} catch (error) {
		console.error("GET /api/messages/unread-count error:", error);
		return serverError();
	}
}
