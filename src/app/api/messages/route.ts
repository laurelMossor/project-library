import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, badRequest, notFound, serverError } from "@/lib/utils/server/api-response";

/**
 * POST /api/messages
 * Send a message as activeOwnerId
 * 
 * Body: { receiverOwnerId: string, content: string }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { receiverOwnerId, content } = body;

		if (!receiverOwnerId || typeof receiverOwnerId !== "string") {
			return badRequest("receiverOwnerId is required");
		}

		if (!content || typeof content !== "string" || content.trim().length === 0) {
			return badRequest("content is required");
		}

		// Can't message yourself
		if (receiverOwnerId === ctx.activeOwnerId) {
			return badRequest("Cannot send a message to yourself");
		}

		// Verify receiver exists
		const receiver = await prisma.owner.findUnique({
			where: { id: receiverOwnerId },
			select: { id: true, orgId: true },
		});

		if (!receiver) {
			return notFound("Receiver not found");
		}

		// Get sender's orgId for denormalization
		const senderOrgId = ctx.activeOwner.orgId;
		const receiverOrgId = receiver.orgId;

		const message = await prisma.message.create({
			data: {
				senderId: ctx.activeOwnerId,
				receiverId: receiverOwnerId,
				content: content.trim(),
				senderOrgId,
				receiverOrgId,
			},
		});

		return success(
			{
				message: {
					id: message.id,
					senderId: message.senderId,
					receiverId: message.receiverId,
					content: message.content,
					createdAt: message.createdAt,
					readAt: message.readAt,
				},
			},
			201
		);
	} catch (error) {
		console.error("POST /api/messages error:", error);
		return serverError();
	}
}
