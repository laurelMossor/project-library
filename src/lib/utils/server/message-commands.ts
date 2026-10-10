// ⚠️ SERVER-ONLY: Guarded messaging writes behind the Server Actions in src/lib/actions/message.ts.
//
// Every write takes the same steps: the acting identity (a client `asPageId` is verified, never
// trusted; VISIBILITY_RULES §1.9), then participation in the addressed conversation (not_found for
// non-participants, never forbidden), then the write in message.ts. Refusals throw DomainError.
import { ConversationKind } from "@prisma/client";
import { validateGroupMemberRefs, validateGroupName, validateMessageContent } from "@/lib/validations";
import { asPageIdOf } from "@/lib/const/messaging";
import type { MessagingIdentityRef } from "@/lib/const/messaging";
import type { ConversationRef } from "@/lib/types/message";
import { DomainError } from "./domain-error";
import { canManagePage } from "./permission";
import { logAction } from "./log";
import {
	addGroupMembers,
	createGroup,
	findOrCreateDirectConversation,
	getParticipation,
	leaveGroup,
	renameGroup,
	resolveMessagingIdentity,
	sendConversationMessage,
	type MessagingIdentity,
} from "./message";

/** A message.ts failure as a DomainError (404 → not_found, 400 → invalid). */
function unwrap<T>(result: { ok: true; value: T } | { ok: false; status: 400 | 404; error: string }): T {
	if (!result.ok) throw new DomainError(result.error, result.status === 404 ? "not_found" : "invalid");
	return result.value;
}

function requireValid(check: { valid: boolean; error?: string }, fallback: string): void {
	if (!check.valid) throw new DomainError(check.error || fallback);
}

/** The identity `userId` acts as, or a refusal when they name a page they can't act as. */
export async function requireMessagingIdentity(userId: string, asPageId: unknown): Promise<MessagingIdentity> {
	const identity = await resolveMessagingIdentity(userId, typeof asPageId === "string" ? asPageId : null);
	if (!identity) throw new DomainError("You don't have permission to act as this page");
	return identity;
}

/** As `requireMessagingIdentity`, plus that identity must participate in the conversation. */
async function requireParticipant(userId: string, { conversationId, asPageId }: ConversationRef) {
	const identity = await requireMessagingIdentity(userId, asPageId);
	const participation = await getParticipation(conversationId, identity);
	if (!participation) throw new DomainError("Conversation not found", "not_found");
	return { identity, participation };
}

function requireGroup(kind: ConversationKind, refusal: string): void {
	if (kind !== ConversationKind.GROUP) throw new DomainError(refusal);
}

/** Send into a conversation (DM or group) as the acting identity. */
export async function sendMessage(userId: string, input: ConversationRef & { content: string }) {
	const { identity, participation } = await requireParticipant(userId, input);
	requireValid(validateMessageContent(input.content), "Invalid message content");

	const message = await sendConversationMessage({
		conversationId: input.conversationId,
		identity,
		senderUserId: userId,
		content: input.content.trim(),
	});
	logAction("message.sent", userId, {
		conversationId: input.conversationId,
		asPageId: asPageIdOf(identity),
		kind: participation.conversation.kind,
	});
	return { id: message.id, conversationId: input.conversationId, content: message.content, createdAt: message.createdAt };
}

/** Resolve (creating an empty, inbox-hidden one if needed) the DM with a user or page. */
export async function resolveDirectConversation(
	userId: string,
	input: { target: MessagingIdentityRef; asPageId?: string | null },
): Promise<string> {
	const identity = await requireMessagingIdentity(userId, input.asPageId);
	const { target } = input;
	if ((target?.type !== "user" && target?.type !== "page") || typeof target.id !== "string" || !target.id) {
		throw new DomainError("A user or page to message is required");
	}
	return unwrap(await findOrCreateDirectConversation(identity, { type: target.type, id: target.id })).id;
}

/** Create a GROUP as the acting identity (the creator is always a member). */
export async function startGroup(
	userId: string,
	input: { members: MessagingIdentityRef[]; name?: string | null; asPageId?: string | null },
): Promise<string> {
	const identity = await requireMessagingIdentity(userId, input.asPageId);
	requireValid(validateGroupName(input.name), "Invalid group name");
	const membersCheck = validateGroupMemberRefs(input.members);
	requireValid(membersCheck, "Invalid members");

	const { id } = unwrap(await createGroup(identity, membersCheck.refs!, input.name));
	logAction("message.group_created", userId, {
		conversationId: id,
		memberCount: membersCheck.refs!.length,
		asPageId: asPageIdOf(identity),
	});
	return id;
}

/** Rename and/or add members to a GROUP. Any participant may do either (no roles in the MVP). */
export async function editGroup(
	userId: string,
	input: ConversationRef & { name?: string | null; addMembers?: MessagingIdentityRef[] },
): Promise<{ added: number }> {
	const { participation } = await requireParticipant(userId, input);
	requireGroup(participation.conversation.kind, "Only group conversations can be edited");

	const renaming = "name" in input;
	const adding = input.addMembers !== undefined;
	if (!renaming && !adding) throw new DomainError("Nothing to update");
	if (renaming) requireValid(validateGroupName(input.name), "Invalid group name");

	let added = 0;
	if (adding) {
		const membersCheck = validateGroupMemberRefs(input.addMembers);
		requireValid(membersCheck, "Invalid members");
		added = unwrap(await addGroupMembers(input.conversationId, membersCheck.refs!)).added;
	}
	if (renaming) await renameGroup(input.conversationId, input.name ?? null);
	return { added };
}

/**
 * Remove the acting identity from a GROUP. Leaving as a page removes it for every manager (and a
 * re-add loses earlier history), so it's a manage action: ADMIN only. The last member out deletes it.
 */
export async function leaveGroupAs(userId: string, input: ConversationRef): Promise<{ deletedConversation: boolean }> {
	const { identity, participation } = await requireParticipant(userId, input);
	requireGroup(participation.conversation.kind, "Only group conversations can be left");
	// The caller can already see this conversation (they manage the page), so forbidden leaks nothing.
	if (identity.type === "page" && !(await canManagePage(userId, identity.id))) {
		throw new DomainError("Only a page admin can remove the page from a group", "forbidden");
	}

	const result = await leaveGroup(input.conversationId, identity);
	logAction("message.group_left", userId, {
		conversationId: input.conversationId,
		deletedConversation: result.deletedConversation,
		asPageId: asPageIdOf(identity),
	});
	return result;
}
