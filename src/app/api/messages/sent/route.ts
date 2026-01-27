import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, serverError } from "@/lib/utils/server/api-response";

/**
 * GET /api/messages/sent
 * Get messages sent by activeOwnerId
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const messages = await prisma.message.findMany({
			where: { senderId: ctx.activeOwnerId },
			include: {
				receiver: {
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
				receiver: {
					id: m.receiver.id,
					type: m.receiver.type,
					user: m.receiver.user,
					org: m.receiver.org,
				},
			})),
		});
	} catch (error) {
		console.error("GET /api/messages/sent error:", error);
		return serverError();
	}
}
