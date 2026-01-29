import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateMessageContent } from "@/lib/validations";

/**
 * POST /api/messages
 * Send a message as activeOwnerId
 * Protected endpoint
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
		const { receiverId, content } = body;

		if (!receiverId || typeof receiverId !== "string") {
			return badRequest("receiverId is required");
		}

		// Validate content
		const contentValidation = validateMessageContent(content);
		if (!contentValidation.valid) {
			return badRequest(contentValidation.error || "Invalid message content");
		}

		// Can't message yourself
		if (receiverId === ctx.activeOwnerId) {
			return badRequest("Cannot send a message to yourself");
		}

		// Verify receiver exists
		const receiver = await prisma.owner.findUnique({
			where: { id: receiverId },
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
				receiverId: receiverId,
				content: content.trim(),
				senderOrgId,
				receiverOrgId,
			},
		});

		return NextResponse.json(
			{
				id: message.id,
				senderId: message.senderId,
				receiverId: message.receiverId,
				content: message.content,
				createdAt: message.createdAt,
				readAt: message.readAt,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/messages error:", error);
		return serverError();
	}
}
