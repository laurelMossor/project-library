// Shapes of the messaging API payloads (inbox + thread) — the single definition for both sides. The
// server (src/lib/utils/server/message.ts) returns the `<Date>` forms; clients receive them over JSON,
// where dates become ISO strings (the default `D = string`).
import type { CardPage, CardUser } from "./card";

/** User embed as sent by the messaging API (matches publicUserEmbedFields). */
export type MessageUser = CardUser & { firstName: string | null; lastName: string | null };

export type ConversationKind = "DIRECT" | "GROUP";

/** Who a message is from, as other members see it. A page message never names its human sender. */
export type MessageAuthor =
	| { type: "user"; user: MessageUser | null }
	| { type: "page"; page: CardPage | null };

export type ConversationMember =
	| { type: "user"; id: string; user: MessageUser | null; isYou: boolean }
	| { type: "page"; id: string; page: CardPage | null; isYou: boolean };

export type ConversationSummary<D = string> = {
	id: string;
	kind: ConversationKind;
	name: string | null;
	updatedAt: D;
	members: ConversationMember[];
	unreadCount: number;
	lastMessage: {
		id: string;
		content: string;
		createdAt: D;
		isOwn: boolean;
		author: MessageAuthor;
	} | null;
};

export type ThreadMessage<D = string> = {
	id: string;
	content: string;
	createdAt: D;
	isOwn: boolean;
	author: MessageAuthor;
	/** The human behind a page message — present only when the viewer is that same page. */
	sentBy: MessageUser | null;
};

export type ConversationThreadData<D = string> = {
	id: string;
	kind: ConversationKind;
	name: string | null;
	members: ConversationMember[];
	/** A group the acting identity may leave (a page needs its ADMIN). */
	canLeave: boolean;
	messages: ThreadMessage<D>[];
};
