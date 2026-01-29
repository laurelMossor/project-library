// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.
//
// Note: Messaging utilities have been moved to API routes.
// See: /api/messages/route.ts, /api/messages/inbox/route.ts, /api/messages/sent/route.ts
// This file is kept for backward compatibility but may be deprecated.

import { prisma } from "./prisma";

export interface MessageOwnerInfo {
	id: string;
	type: "USER" | "ORG";
	user: {
		id: string;
		username: string;
		firstName: string | null;
		lastName: string | null;
	} | null;
	org: {
		id: string;
		slug: string;
		name: string;
	} | null;
}

export interface MessageItem {
	id: string;
	senderId: string;
	receiverId: string;
	content: string;
	createdAt: Date;
	readAt: Date | null;
	sender?: MessageOwnerInfo;
	receiver?: MessageOwnerInfo;
}

const ownerSelectFields = {
	id: true,
	type: true,
	user: {
		select: {
			id: true,
			username: true,
			firstName: true,
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
};

/**
 * Get inbox messages for an owner
 */
export async function getInboxMessages(ownerId: string): Promise<MessageItem[]> {
	const messages = await prisma.message.findMany({
		where: { receiverId: ownerId },
		include: {
			sender: { select: ownerSelectFields },
		},
		orderBy: { createdAt: "desc" },
		take: 50,
	});

	return messages.map((m) => ({
		id: m.id,
		senderId: m.senderId,
		receiverId: m.receiverId,
		content: m.content,
		createdAt: m.createdAt,
		readAt: m.readAt,
		sender: m.sender as MessageOwnerInfo,
	}));
}

/**
 * Get sent messages for an owner
 */
export async function getSentMessages(ownerId: string): Promise<MessageItem[]> {
	const messages = await prisma.message.findMany({
		where: { senderId: ownerId },
		include: {
			receiver: { select: ownerSelectFields },
		},
		orderBy: { createdAt: "desc" },
		take: 50,
	});

	return messages.map((m) => ({
		id: m.id,
		senderId: m.senderId,
		receiverId: m.receiverId,
		content: m.content,
		createdAt: m.createdAt,
		readAt: m.readAt,
		receiver: m.receiver as MessageOwnerInfo,
	}));
}

/**
 * Send a message
 */
export async function sendMessage(
	senderId: string,
	receiverId: string,
	content: string
): Promise<MessageItem> {
	// Get sender's orgId for denormalization
	const sender = await prisma.owner.findUnique({
		where: { id: senderId },
		select: { orgId: true },
	});

	const receiver = await prisma.owner.findUnique({
		where: { id: receiverId },
		select: { orgId: true },
	});

	const message = await prisma.message.create({
		data: {
			senderId,
			receiverId,
			content,
			senderOrgId: sender?.orgId || null,
			receiverOrgId: receiver?.orgId || null,
		},
	});

	return {
		id: message.id,
		senderId: message.senderId,
		receiverId: message.receiverId,
		content: message.content,
		createdAt: message.createdAt,
		readAt: message.readAt,
	};
}

/**
 * Mark a message as read
 */
export async function markMessageRead(messageId: string): Promise<void> {
	await prisma.message.update({
		where: { id: messageId },
		data: { readAt: new Date() },
	});
}

/**
 * Conversation with another user
 */
export interface Conversation {
	otherUser: {
		id: string;
		username: string;
		firstName: string | null;
		middleName: string | null;
		lastName: string | null;
	};
	lastMessage: {
		id: string;
		senderId: string;
		content: string;
		createdAt: Date;
	} | null;
}

/**
 * Get all conversations for a user (grouped by other participant)
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
	// First, get the user's personal owner ID
	const personalOwner = await prisma.owner.findFirst({
		where: { userId, orgId: null },
		select: { id: true },
	});

	if (!personalOwner) {
		return [];
	}

	const ownerId = personalOwner.id;

	// Get all messages where user is sender or receiver
	const messages = await prisma.message.findMany({
		where: {
			OR: [
				{ senderId: ownerId },
				{ receiverId: ownerId },
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
		orderBy: { createdAt: "desc" },
	});

	// Group messages by conversation partner
	const conversationMap = new Map<string, Conversation>();

	for (const msg of messages) {
		const isReceived = msg.receiverId === ownerId;
		const otherOwner = isReceived ? msg.sender : msg.receiver;
		const otherUser = otherOwner?.user;

		if (!otherUser) continue;

		// Use the other user's ID as the conversation key
		const convKey = otherUser.id;

		if (!conversationMap.has(convKey)) {
			conversationMap.set(convKey, {
				otherUser: {
					id: otherUser.id,
					username: otherUser.username,
					firstName: otherUser.firstName,
					middleName: otherUser.middleName,
					lastName: otherUser.lastName,
				},
				lastMessage: {
					id: msg.id,
					senderId: msg.senderId,
					content: msg.content,
					createdAt: msg.createdAt,
				},
			});
		}
	}

	return Array.from(conversationMap.values());
}
