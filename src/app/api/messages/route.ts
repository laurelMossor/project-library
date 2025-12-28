import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConversations, sendMessage } from "@/lib/utils/server/message";
import { unauthorized, badRequest, notFound } from "@/lib/utils/errors";
import { validateMessageContent } from "@/lib/validations";
import { prisma } from "@/lib/utils/server/prisma";

// GET /api/messages - Get all conversations for the current user
// Protected endpoint (requires authentication)
// Returns list of conversations with other users and last message preview
export async function GET() {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	try {
		const conversations = await getConversations(session.user.id);
		return NextResponse.json(conversations);
	} catch (error) {
		console.error("Error fetching conversations:", error);
		return badRequest("Failed to fetch conversations");
	}
}

// POST /api/messages - Send a new message to another user
// Protected endpoint (requires authentication)
// Body: { receiverId: string, content: string }
export async function POST(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const data = await request.json();
	const { receiverId, content } = data;

	// Validate receiverId is provided
	if (!receiverId || typeof receiverId !== "string") {
		return badRequest("Receiver ID is required");
	}

	// Prevent users from messaging themselves
	if (receiverId === session.user.id) {
		return badRequest("Cannot send message to yourself");
	}

	// Validate receiver exists
	const receiver = await prisma.user.findUnique({
		where: { id: receiverId },
		select: { id: true },
	});

	if (!receiver) {
		return notFound("Receiver not found");
	}

	// Validate message content
	const validation = validateMessageContent(content);
	if (!validation.valid) {
		return badRequest(validation.error || "Invalid message content");
	}

	try {
		const message = await sendMessage(session.user.id, receiverId, content);
		return NextResponse.json(message, { status: 201 });
	} catch (error) {
		console.error("Error sending message:", error);
		return badRequest("Failed to send message");
	}
}

