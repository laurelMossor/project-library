// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { Conversation, MessageWithUsers } from "../../types/message";

// Get all conversations for a user (list of other users they've messaged or been messaged by)
// Returns conversation summaries with other user info and last message preview
export async function getConversations(userId: string): Promise<Conversation[]> {
	// Find all messages where the user is either sender or receiver
	const messages = await prisma.message.findMany({
		where: {
			OR: [
				{ senderId: userId },
				{ receiverId: userId },
			],
		},
		include: {
			sender: {
				select: {
					id: true,
					username: true,
					name: true,
				},
			},
			receiver: {
				select: {
					id: true,
					username: true,
					name: true,
				},
			},
		},
		orderBy: { createdAt: "desc" }, // Get most recent messages first
	});

	// Group messages by other user and get the most recent message for each conversation
	const conversationMap = new Map<string, {
		otherUser: { id: string; username: string; name: string | null };
		lastMessage: { content: string; createdAt: Date; senderId: string };
	}>();

	for (const message of messages) {
		// Determine who the "other user" is in this conversation
		const otherUser = message.senderId === userId ? message.receiver : message.sender;
		const otherUserId = otherUser.id;

		// Only keep the first (most recent) message for each other user
		if (!conversationMap.has(otherUserId)) {
			conversationMap.set(otherUserId, {
				otherUser: {
					id: otherUser.id,
					username: otherUser.username,
					name: otherUser.name,
				},
				lastMessage: {
					content: message.content,
					createdAt: message.createdAt,
					senderId: message.senderId,
				},
			});
		}
	}

	// Convert map to array of Conversation objects
	const conversations: Conversation[] = Array.from(conversationMap.values()).map(conv => ({
		otherUser: conv.otherUser,
		lastMessage: conv.lastMessage,
	}));

	return conversations;
}

// Get all messages between two users, sorted by creation date (oldest first)
// Returns messages with sender and receiver information included
export async function getMessages(userId: string, otherUserId: string): Promise<MessageWithUsers[]> {
	const messages = await prisma.message.findMany({
		where: {
			OR: [
				// Messages where current user is sender and other user is receiver
				{ senderId: userId, receiverId: otherUserId },
				// Messages where current user is receiver and other user is sender
				{ senderId: otherUserId, receiverId: userId },
			],
		},
		include: {
			sender: {
				select: {
					id: true,
					username: true,
					name: true,
				},
			},
			receiver: {
				select: {
					id: true,
					username: true,
					name: true,
				},
			},
		},
		orderBy: { createdAt: "asc" }, // Oldest messages first
	});

	return messages.map((msg: {
		id: string;
		content: string;
		senderId: string;
		receiverId: string;
		createdAt: Date;
		readAt: Date | null;
		sender: { id: string; username: string; name: string | null };
		receiver: { id: string; username: string; name: string | null };
	}) => ({
		id: msg.id,
		content: msg.content,
		senderId: msg.senderId,
		receiverId: msg.receiverId,
		createdAt: msg.createdAt,
		readAt: msg.readAt,
		sender: msg.sender,
		receiver: msg.receiver,
	}));
}

// Create a new message between two users
// Returns the created message with sender and receiver information
export async function sendMessage(
	senderId: string,
	receiverId: string,
	content: string
): Promise<MessageWithUsers> {
	const message = await prisma.message.create({
		data: {
			content: content.trim(),
			senderId,
			receiverId,
		},
		include: {
			sender: {
				select: {
					id: true,
					username: true,
					name: true,
				},
			},
			receiver: {
				select: {
					id: true,
					username: true,
					name: true,
				},
			},
		},
	});

	return {
		id: message.id,
		content: message.content,
		senderId: message.senderId,
		receiverId: message.receiverId,
		createdAt: message.createdAt,
		readAt: message.readAt,
		sender: message.sender,
		receiver: message.receiver,
	};
}

