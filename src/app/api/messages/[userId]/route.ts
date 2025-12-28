import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMessages } from "@/lib/utils/server/message";
import { unauthorized, badRequest, notFound } from "@/lib/utils/errors";
import { prisma } from "@/lib/utils/server/prisma";

// GET /api/messages/[userId] - Get all messages between current user and specified user
// Protected endpoint (requires authentication)
// Returns messages sorted by creation date (oldest first)
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ userId: string }> }
) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const { userId } = await params;

	// Validate the other user exists
	const otherUser = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true },
	});

	if (!otherUser) {
		return notFound("User not found");
	}

	try {
		const messages = await getMessages(session.user.id, userId);
		
		// If no messages, still return empty array with other user info for convenience
		// The frontend can still display the conversation page
		if (messages.length === 0) {
			// Fetch other user info to include in response
			const otherUser = await prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					username: true,
					name: true,
				},
			});
			
			if (otherUser) {
				return NextResponse.json({
					messages: [],
					otherUser,
				});
			}
		}
		
		return NextResponse.json(messages);
	} catch (error) {
		console.error("Error fetching messages:", error);
		return badRequest("Failed to fetch messages");
	}
}

