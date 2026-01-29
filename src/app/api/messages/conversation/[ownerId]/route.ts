import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";

interface Params {
	params: Promise<{ ownerId: string }>;
}

/**
 * GET /api/messages/[ownerId]
 * Get conversation with another owner
 * Protected endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { ownerId: otherOwnerId } = await params;
		console.log("[messages/ownerId] GET - otherOwnerId:", otherOwnerId);

		const ctx = await getSessionContext();
		if (!ctx) {
			console.log("[messages/ownerId] GET - unauthorized, no session");
			return unauthorized();
		}

		console.log("[messages/ownerId] GET - activeOwnerId:", ctx.activeOwnerId);

		// Verify other owner exists
		const otherOwner = await prisma.owner.findUnique({
			where: { id: otherOwnerId },
			include: {
				user: {
					select: {
						id: true,
						username: true,
						firstName: true,
						middleName: true,
						lastName: true,
					},
				},
				org: {
					select: {
						id: true,
						slug: true,
						name: true,
					},
				},
			},
		});

		if (!otherOwner) {
			console.log("[messages/ownerId] GET - other owner not found:", otherOwnerId);
			return notFound("User not found");
		}

		console.log("[messages/ownerId] GET - otherOwner type:", otherOwner.type, "user:", otherOwner.user?.username, "org:", otherOwner.org?.slug);

		// Get messages between current owner and other owner
		const messages = await prisma.message.findMany({
			where: {
				OR: [
					{ senderId: ctx.activeOwnerId, receiverId: otherOwnerId },
					{ senderId: otherOwnerId, receiverId: ctx.activeOwnerId },
				],
			},
			include: {
				sender: {
					select: {
						id: true,
						user: {
							select: {
								id: true,
								username: true,
								firstName: true,
								middleName: true,
								lastName: true,
							},
						},
					},
				},
				receiver: {
					select: {
						id: true,
						user: {
							select: {
								id: true,
								username: true,
								firstName: true,
								middleName: true,
								lastName: true,
							},
						},
					},
				},
			},
			orderBy: { createdAt: "asc" },
		});

		console.log("[messages/ownerId] GET - found", messages.length, "messages");

		// Transform to expected format
		const transformedMessages = messages.map((m) => ({
			id: m.id,
			content: m.content,
			senderId: m.senderId,
			receiverId: m.receiverId,
			createdAt: m.createdAt,
			readAt: m.readAt,
			sender: m.sender.user ? {
				id: m.sender.user.id,
				username: m.sender.user.username,
				firstName: m.sender.user.firstName,
				middleName: m.sender.user.middleName,
				lastName: m.sender.user.lastName,
			} : null,
			receiver: m.receiver.user ? {
				id: m.receiver.user.id,
				username: m.receiver.user.username,
				firstName: m.receiver.user.firstName,
				middleName: m.receiver.user.middleName,
				lastName: m.receiver.user.lastName,
			} : null,
		}));

		// Build other user info for the response
		const otherUserInfo = otherOwner.user ? {
			id: otherOwner.user.id,
			username: otherOwner.user.username,
			firstName: otherOwner.user.firstName,
			middleName: otherOwner.user.middleName,
			lastName: otherOwner.user.lastName,
		} : otherOwner.org ? {
			id: otherOwner.org.id,
			username: otherOwner.org.slug,
			firstName: otherOwner.org.name,
			middleName: null,
			lastName: null,
		} : null;

		return NextResponse.json({
			messages: transformedMessages,
			otherUser: otherUserInfo,
		});
	} catch (error) {
		console.error("[messages/ownerId] GET error:", error);
		return serverError();
	}
}
