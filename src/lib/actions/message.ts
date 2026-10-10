"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import {
	editGroup,
	leaveGroupAs,
	resolveDirectConversation,
	sendMessage,
	startGroup,
} from "@/lib/utils/server/message-commands";
import type { MessagingIdentityRef } from "@/lib/const/messaging";
import type { ConversationRef } from "@/lib/types/message";

// Messaging writes. The inbox, thread, and unread badges are client-polled islands, so a server
// refresh would re-render nothing they show: every action skips it and callers refetch instead.

const HOUR = 60 * 60 * 1000;

const conversationRef = <T extends ConversationRef>(input: T): T => ({
	...input,
	conversationId: requireId(input?.conversationId, "conversation"),
});

/** Send into a conversation (DM or group) as the acting identity. */
export const sendMessageAction = authedAction(
	async (ctx, input: ConversationRef & { content: string }) => sendMessage(ctx.userId, conversationRef(input)),
	{ refresh: false, rateLimit: { key: "message-send", maxRequests: 30, windowMs: 60 * 1000 } },
);

/** Resolve (creating an empty one if needed) the DM with a user or page; returns its id. */
export const resolveDirectConversationAction = authedAction(
	async (ctx, input: { target: MessagingIdentityRef; asPageId?: string | null }) =>
		resolveDirectConversation(ctx.userId, input ?? {}),
	// Resolving can create a (hidden, empty) DM row with anyone, so it's rate-limited like group creation.
	{ refresh: false, rateLimit: { key: "dm-resolve", maxRequests: 120, windowMs: HOUR } },
);

/** Start a group as the acting identity; returns its id. */
export const createGroupAction = authedAction(
	async (ctx, input: { members: MessagingIdentityRef[]; name?: string | null; asPageId?: string | null }) =>
		startGroup(ctx.userId, input ?? { members: [] }),
	// Anyone can be added to a group, so creation is rate-limited against spam.
	{ refresh: false, rateLimit: { key: "group-create", maxRequests: 10, windowMs: HOUR } },
);

/** Rename and/or add members to a group. */
export const editGroupAction = authedAction(
	async (ctx, input: ConversationRef & { name?: string | null; addMembers?: MessagingIdentityRef[] }) =>
		editGroup(ctx.userId, conversationRef(input)),
	{ refresh: false, rateLimit: { key: "group-edit", maxRequests: 30, windowMs: HOUR } },
);

/** Leave a group as the acting identity (a page needs its ADMIN). */
export const leaveGroupAction = authedAction(
	async (ctx, input: ConversationRef) => leaveGroupAs(ctx.userId, conversationRef(input)),
	{ refresh: false },
);
