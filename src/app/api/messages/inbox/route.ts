import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, serverError } from "@/lib/utils/server/api-response";

/**
 * GET /api/messages/inbox
 * Get messages received by activeOwnerId
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const messages = await prisma.message.findMany({
			where: { receiverId: ctx.activeOwnerId },
			include: {
				sender: {
					select: {
						id: true,
						type: true,
						user: {
							select: {
								id: true,
								username: true,
								displayName: true,
								firstName: true,
								lastName: true,
								avatarImageId: true,
							},
						},
						org: {
							select: {
								id: true,
								slug: true,
								name: true,
								avatarImageId: true,
							},
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		return success({
			messages: messages.map((m) => ({
				id: m.id,
				senderId: m.senderId,
				receiverId: m.receiverId,
				content: m.content,
				createdAt: m.createdAt,
				readAt: m.readAt,
				sender: {
					id: m.sender.id,
					type: m.sender.type,
					user: m.sender.user,
					org: m.sender.org,
				},
			})),
		});
	} catch (error) {
		console.error("GET /api/messages/inbox error:", error);
		return serverError();
	}
}
