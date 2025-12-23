// Type definitions for messaging functionality
// Defines interfaces for messages, conversations, and message data structures

// Message data structure as stored in the database
export interface Message {
	id: string;
	content: string;
	senderId: string;
	receiverId: string;
	createdAt: Date;
	readAt: Date | null;
}

// Message data with sender/receiver user information included
export interface MessageWithUsers extends Message {
	sender: {
		id: string;
		username: string;
		name: string | null;
	};
	receiver: {
		id: string;
		username: string;
		name: string | null;
	};
}

// Data structure for creating a new message via API
export interface MessageData {
	receiverId: string;
	content: string;
}

// Conversation summary showing the other user and last message preview
export interface Conversation {
	otherUser: {
		id: string;
		username: string;
		name: string | null;
	};
	lastMessage: {
		content: string;
		createdAt: Date;
		senderId: string;
	} | null;
	unreadCount?: number; // Optional for future implementation
}

