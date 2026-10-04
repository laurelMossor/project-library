// ⚠️ SERVER-ONLY: Messaging — the single owner of conversation access, read state, and group lifecycle.
//
// Everything is addressed by conversation id and scoped to ONE acting identity: the user personally, or
// a page they may act as (ADMIN/EDITOR, verified from the session by `resolveMessagingIdentity`). Routes
// stay thin: resolve the identity, call in here, map the result to a response.
//
// Read state is per participant (`ConversationParticipant.lastReadAt`) and a participant only sees
// messages sent at/after it joined (its `createdAt`). A page participant's marker is shared by all of its
// managers — the page inbox is a shared inbox.
import { ConversationKind, EmailSourceType, NotificationCategory, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { canManagePage, canPostAsPage, getActingManagerIdsByPage } from "./permission";
import { enqueueEmails, type EmailOutboxEntry } from "./email-outbox";
import { publicUserEmbedFields } from "./user";
import { publicPageEmbedFields } from "./fields";
import {
	MAX_GROUP_PARTICIPANTS,
	asPageIdOf,
	identityKey,
	participantIdentity,
	type MessagingIdentityRef,
} from "@/lib/const/messaging";
import type { ConversationMember, ConversationSummary, ConversationThreadData, MessageAuthor } from "@/lib/types/message";
import type { CardPage } from "@/lib/types/card";

export type MessagingIdentity = MessagingIdentityRef;

type Result<T> = { ok: true; value: T } | { ok: false; status: 400 | 404; error: string };
const fail = (status: 400 | 404, error: string) => ({ ok: false, status, error }) as const;

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * The identity the caller acts as for a messaging request. No `asPageId` → the user personally; an
 * `asPageId` is honoured only if the session user may act as that page (ADMIN/EDITOR). `null` means the
 * caller named a page they can't act as. Never trust a client `asPageId` without passing through here.
 */
export async function resolveMessagingIdentity(
	userId: string,
	asPageId: string | null | undefined,
): Promise<MessagingIdentity | null> {
	if (!asPageId) return { type: "user", id: userId };
	return (await canPostAsPage(userId, asPageId)) ? { type: "page", id: asPageId } : null;
}

/** Participant-row filter for an identity (exactly one of userId/pageId). */
export function identityWhere(identity: MessagingIdentity): { userId: string } | { pageId: string } {
	return identity.type === "page" ? { pageId: identity.id } : { userId: identity.id };
}

/**
 * Messages this identity authored. A page owns everything sent as it (whichever manager sent it); a
 * user owns only what they sent personally. Defined once here — a raw `senderId !== me` check is wrong
 * as soon as a user and a page they manage share a conversation.
 */
export function ownMessageWhere(identity: MessagingIdentity): Prisma.MessageWhereInput {
	return identity.type === "page" ? { asPageId: identity.id } : { senderId: identity.id, asPageId: null };
}

export function isOwnMessage(message: { senderId: string; asPageId: string | null }, identity: MessagingIdentity): boolean {
	return identity.type === "page"
		? message.asPageId === identity.id
		: message.senderId === identity.id && message.asPageId === null;
}

// ─── Read state ──────────────────────────────────────────────────────────────

type ParticipantWindow = { conversationId: string; createdAt: Date; lastReadAt: Date | null };

/** Messages in one conversation this identity hasn't read: after its read marker, never before it joined. */
function unreadWindow(p: ParticipantWindow): Prisma.MessageWhereInput {
	const createdAt = p.lastReadAt && p.lastReadAt >= p.createdAt ? { gt: p.lastReadAt } : { gte: p.createdAt };
	return { conversationId: p.conversationId, createdAt };
}

/** Unread count per conversation for an identity (conversations with 0 unread are absent). */
export async function getUnreadCountsByConversation(
	identity: MessagingIdentity,
	participants?: ParticipantWindow[],
): Promise<Map<string, number>> {
	const parts = participants ?? await prisma.conversationParticipant.findMany({
		where: identityWhere(identity),
		select: { conversationId: true, createdAt: true, lastReadAt: true },
	});
	if (parts.length === 0) return new Map();
	const rows = await prisma.message.groupBy({
		by: ["conversationId"],
		where: { OR: parts.map(unreadWindow), NOT: ownMessageWhere(identity) },
		_count: { _all: true },
	});
	return new Map(rows.map((r) => [r.conversationId, r._count._all]));
}

/** Total unread messages across all of an identity's conversations. */
export async function countUnreadForIdentity(identity: MessagingIdentity): Promise<number> {
	let total = 0;
	for (const n of (await getUnreadCountsByConversation(identity)).values()) total += n;
	return total;
}

/**
 * Move this identity's read marker forward to `upTo` — a timestamp the caller already holds (the newest
 * message it loaded, or the one it just sent). The `lt` filter is the whole rule: a marker already at or
 * past `upTo` stays put, so a message that arrives after the view stays unread and can still email.
 * `db` is the open transaction when the caller is already inside one (sending); otherwise the shared client.
 */
export async function advanceReadMarker(
	conversationId: string,
	identity: MessagingIdentity,
	upTo: Date,
	db: Prisma.TransactionClient = prisma,
): Promise<void> {
	await db.conversationParticipant.updateMany({
		where: {
			conversationId,
			...identityWhere(identity),
			OR: [{ lastReadAt: null }, { lastReadAt: { lt: upTo } }],
		},
		data: { lastReadAt: upTo },
	});
}

/**
 * Read markers for every participant of the given conversations, keyed by `readMarkerKey`. The value is
 * the participant's `lastReadAt` (null = nothing read); a missing key means the identity is not (or no
 * longer) a participant. Used by the email flush for per-recipient read-suppression.
 */
export async function loadReadMarkers(conversationIds: string[]): Promise<Map<string, Date | null>> {
	const ids = [...new Set(conversationIds)];
	if (ids.length === 0) return new Map();
	const participants = await prisma.conversationParticipant.findMany({
		where: { conversationId: { in: ids } },
		select: { conversationId: true, userId: true, pageId: true, lastReadAt: true },
	});
	return new Map(participants.map((p) => [readMarkerKey(p.conversationId, participantIdentity(p)), p.lastReadAt]));
}

export const readMarkerKey = (conversationId: string, identity: MessagingIdentity) =>
	`${conversationId}|${identityKey(identity)}`;

/** Has the identity with this read marker read `message`? (Same rule as `unreadWindow`.) */
export function isMessageReadBy(marker: Date | null, message: { createdAt: Date }): boolean {
	return !!marker && marker >= message.createdAt;
}

// ─── Access ──────────────────────────────────────────────────────────────────

/**
 * The conversation + this identity's participant row, or null when the identity isn't a participant.
 * Callers return 404 on null (never 403) so a non-participant can't probe which conversations exist.
 */
export async function getParticipation(conversationId: string, identity: MessagingIdentity) {
	const participant = await prisma.conversationParticipant.findFirst({
		where: { conversationId, ...identityWhere(identity) },
		select: { createdAt: true, lastReadAt: true, conversation: { select: { id: true, kind: true, name: true } } },
	});
	if (!participant) return null;
	return { conversation: participant.conversation, joinedAt: participant.createdAt, lastReadAt: participant.lastReadAt };
}

// ─── Shapes returned to the client ───────────────────────────────────────────

const participantInclude = {
	user: { select: publicUserEmbedFields },
	page: { select: publicPageEmbedFields },
} as const;

type UserEmbed = Prisma.UserGetPayload<{ select: typeof publicUserEmbedFields }>;
type PageEmbed = Prisma.PageGetPayload<{ select: typeof publicPageEmbedFields }>;

function toMembers(
	participants: Array<{ userId: string | null; pageId: string | null; user: UserEmbed | null; page: PageEmbed | null }>,
	identity: MessagingIdentity,
): ConversationMember[] {
	const you = identityKey(identity);
	return participants.map((p) => {
		const ref = participantIdentity(p);
		const isYou = identityKey(ref) === you;
		return ref.type === "page"
			? { type: "page", id: ref.id, page: p.page, isYou }
			: { type: "user", id: ref.id, user: p.user, isYou };
	});
}

/** Page embeds for pages that sent messages — reusing members, fetching any that have since left. */
async function pagesById(ids: string[], known: ConversationMember[]): Promise<Map<string, CardPage | null>> {
	const map = new Map<string, CardPage | null>();
	for (const m of known) if (m.type === "page") map.set(m.id, m.page);
	const missing = [...new Set(ids)].filter((id) => !map.has(id));
	if (missing.length) {
		const pages = await prisma.page.findMany({ where: { id: { in: missing } }, select: publicPageEmbedFields });
		for (const p of pages) map.set(p.id, p);
	}
	return map;
}

function authorOf(
	m: { asPageId: string | null; sender: UserEmbed | null },
	pages: Map<string, CardPage | null>,
): MessageAuthor {
	return m.asPageId ? { type: "page", page: pages.get(m.asPageId) ?? null } : { type: "user", user: m.sender };
}

// ─── Inbox ───────────────────────────────────────────────────────────────────

/**
 * The acting identity's conversations, newest first. DMs appear once they have a message (profile
 * "Message" creates the thread eagerly); GROUPs appear from creation so new members can find them.
 * The preview respects join time — a late joiner never sees a message from before they joined.
 */
export async function listInbox(identity: MessagingIdentity, limit = 50): Promise<ConversationSummary<Date>[]> {
	const parts = await prisma.conversationParticipant.findMany({
		where: identityWhere(identity),
		select: { conversationId: true, createdAt: true, lastReadAt: true },
	});
	if (parts.length === 0) return [];
	const joinedAt = new Map(parts.map((p) => [p.conversationId, p.createdAt]));

	const [conversations, unread] = await Promise.all([
		prisma.conversation.findMany({
			where: {
				id: { in: parts.map((p) => p.conversationId) },
				OR: [{ kind: ConversationKind.GROUP }, { messages: { some: {} } }],
			},
			include: {
				participants: { include: participantInclude, orderBy: { createdAt: "asc" } },
				messages: {
					orderBy: { createdAt: "desc" },
					take: 1,
					select: { id: true, content: true, createdAt: true, senderId: true, asPageId: true, sender: { select: publicUserEmbedFields } },
				},
			},
			orderBy: { updatedAt: "desc" },
			take: limit,
		}),
		getUnreadCountsByConversation(identity, parts),
	]);

	const members = new Map(conversations.map((c) => [c.id, toMembers(c.participants, identity)]));
	const pages = await pagesById(
		conversations.flatMap((c) => c.messages.map((m) => m.asPageId).filter((id): id is string => !!id)),
		[...members.values()].flat(),
	);

	return conversations.map((c) => {
		const last = c.messages[0];
		const visible = last && last.createdAt >= joinedAt.get(c.id)!;
		return {
			id: c.id,
			kind: c.kind,
			name: c.name,
			updatedAt: c.updatedAt,
			members: members.get(c.id)!,
			unreadCount: unread.get(c.id) ?? 0,
			lastMessage: visible
				? { id: last.id, content: last.content, createdAt: last.createdAt, isOwn: isOwnMessage(last, identity), author: authorOf(last, pages) }
				: null,
		};
	});
}

// ─── Thread ──────────────────────────────────────────────────────────────────

/**
 * A conversation as the acting identity sees it: members, and messages since it joined. Each page
 * message carries `sentBy` (the human who sent it) ONLY when the viewer is that same page — co-managers
 * coordinate internally, while every other member sees only the page's one voice. A pure read — the GET
 * route advances the read marker after this returns, using the newest message's timestamp.
 */
export async function getThread(
	conversationId: string,
	identity: MessagingIdentity,
	sessionUserId: string,
): Promise<ConversationThreadData<Date> | null> {
	const participation = await getParticipation(conversationId, identity);
	if (!participation) return null;

	const [participants, messages] = await Promise.all([
		prisma.conversationParticipant.findMany({
			where: { conversationId },
			include: participantInclude,
			orderBy: { createdAt: "asc" },
		}),
		prisma.message.findMany({
			where: { conversationId, createdAt: { gte: participation.joinedAt } },
			orderBy: { createdAt: "asc" },
			select: { id: true, content: true, createdAt: true, senderId: true, asPageId: true, sender: { select: publicUserEmbedFields } },
		}),
	]);

	const members = toMembers(participants, identity);
	const pages = await pagesById(messages.map((m) => m.asPageId).filter((id): id is string => !!id), members);
	const { conversation } = participation;

	return {
		id: conversation.id,
		kind: conversation.kind,
		name: conversation.name,
		members,
		// Leaving on a page's behalf removes it for every manager, so it's a manage (ADMIN) action.
		canLeave: conversation.kind === ConversationKind.GROUP
			&& (identity.type === "user" || await canManagePage(sessionUserId, identity.id)),
		messages: messages.map((m) => ({
			id: m.id,
			content: m.content,
			createdAt: m.createdAt,
			isOwn: isOwnMessage(m, identity),
			author: authorOf(m, pages),
			sentBy: m.asPageId && identity.type === "page" && identity.id === m.asPageId ? m.sender : null,
		})),
	};
}

// ─── Send ────────────────────────────────────────────────────────────────────

/**
 * Send as `identity` (already verified as a participant by the caller). Sending advances the sender's
 * own read marker — replying means you've seen the thread. Email fan-out is best-effort and never
 * fails the send.
 */
export async function sendConversationMessage(params: {
	conversationId: string;
	identity: MessagingIdentity;
	senderUserId: string;
	content: string;
}) {
	const { conversationId, identity, senderUserId, content } = params;
	const message = await prisma.$transaction(async (tx) => {
		const created = await tx.message.create({
			data: { conversationId, senderId: senderUserId, content, asPageId: asPageIdOf(identity) ?? null },
		});
		await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: created.createdAt } });
		await advanceReadMarker(conversationId, identity, created.createdAt, tx);
		return created;
	});

	try {
		await enqueueMessageEmails(message, identity);
	} catch (err) {
		console.error("sendConversationMessage: email enqueue failed (message still sent):", err);
	}
	return message;
}

/**
 * One outbox row per recipient identity: user participants directly, page participants fanned out to
 * their ADMIN/EDITOR managers (tagged with the page context). The sending identity and the human who
 * sent it are never emailed. The flush applies preferences + per-recipient read-suppression.
 */
export async function enqueueMessageEmails(
	message: { id: string; conversationId: string; senderId: string },
	sender: MessagingIdentity,
): Promise<void> {
	const participants = await prisma.conversationParticipant.findMany({
		where: { conversationId: message.conversationId },
		select: { userId: true, pageId: true },
	});
	// Filter in JS: a Prisma `NOT { userId }` would also drop page rows (NULL userId) — the SQL NULL trap.
	const recipients = participants.map(participantIdentity).filter((r) => identityKey(r) !== identityKey(sender));
	const managersByPage = await getActingManagerIdsByPage(recipients.filter((r) => r.type === "page").map((r) => r.id));

	const base = { category: NotificationCategory.MESSAGES, sourceType: EmailSourceType.MESSAGE, sourceId: message.id };
	const entries: EmailOutboxEntry[] = [];
	for (const r of recipients) {
		// The human who sent it is never emailed — personally or as a manager of a recipient page.
		const userIds = r.type === "user" ? [r.id] : managersByPage.get(r.id) ?? [];
		for (const userId of userIds) {
			if (userId === message.senderId) continue;
			entries.push({ recipientUserId: userId, contextPageId: r.type === "page" ? r.id : null, ...base });
		}
	}
	await enqueueEmails(entries);
}

// ─── Direct messages ─────────────────────────────────────────────────────────

/** Does this user/page exist? */
async function identityExists(ref: MessagingIdentity): Promise<boolean> {
	return ref.type === "user"
		? !!(await prisma.user.findUnique({ where: { id: ref.id }, select: { id: true } }))
		: !!(await prisma.page.findUnique({ where: { id: ref.id }, select: { id: true } }));
}

/** The DIRECT conversation between exactly these two identities — never a group they share. */
export async function findDirectConversationId(
	a: MessagingIdentity,
	b: MessagingIdentity,
	db: Prisma.TransactionClient = prisma,
): Promise<string | null> {
	const found = await db.conversation.findFirst({
		where: {
			kind: ConversationKind.DIRECT,
			AND: [{ participants: { some: identityWhere(a) } }, { participants: { some: identityWhere(b) } }],
		},
		select: { id: true },
	});
	return found?.id ?? null;
}

/** Resolve (creating if needed) the DM between the acting identity and a target. */
export async function findOrCreateDirectConversation(
	identity: MessagingIdentity,
	target: MessagingIdentity,
): Promise<Result<{ id: string; created: boolean }>> {
	if (identityKey(identity) === identityKey(target)) return fail(400, "Cannot send a message to yourself");
	if (!(await identityExists(target))) return fail(404, target.type === "user" ? "Recipient user not found" : "Recipient page not found");

	// Serialize find-or-create per pair: without the lock, two concurrent resolves (a double-click, two
	// tabs, a StrictMode double effect) both miss and create two DMs, splitting the history.
	const pairKey = [identityKey(identity), identityKey(target)].sort().join("|");
	return prisma.$transaction(async (tx) => {
		// $executeRaw, not $queryRaw: the lock function returns `void`, which $queryRaw can't deserialize.
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pairKey}))`;
		const existing = await findDirectConversationId(identity, target, tx);
		if (existing) return { ok: true as const, value: { id: existing, created: false } };
		const created = await tx.conversation.create({
			data: { kind: ConversationKind.DIRECT, participants: { create: [identityWhere(identity), identityWhere(target)] } },
			select: { id: true },
		});
		return { ok: true as const, value: { id: created.id, created: true } };
	});
}

// ─── Groups ──────────────────────────────────────────────────────────────────

/** Dedupe refs, drop any that match `exclude`, and 404 if any don't exist. */
async function resolveNewMembers(refs: MessagingIdentity[], exclude: Set<string>): Promise<Result<MessagingIdentity[]>> {
	const seen = new Set(exclude);
	const unique: MessagingIdentity[] = [];
	for (const r of refs) {
		if (seen.has(identityKey(r))) continue;
		seen.add(identityKey(r));
		unique.push(r);
	}
	const userIds = unique.filter((r) => r.type === "user").map((r) => r.id);
	const pageIds = unique.filter((r) => r.type === "page").map((r) => r.id);
	const [users, pages] = await Promise.all([
		userIds.length ? prisma.user.count({ where: { id: { in: userIds } } }) : 0,
		pageIds.length ? prisma.page.count({ where: { id: { in: pageIds } } }) : 0,
	]);
	if (users !== userIds.length || pages !== pageIds.length) return fail(404, "Member not found");
	return { ok: true, value: unique };
}

const tooMany = () => fail(400, `A group can have at most ${MAX_GROUP_PARTICIPANTS} members`);

/** Create a GROUP as the acting identity with the given members (the creator is always included). */
export async function createGroup(
	creator: MessagingIdentity,
	members: MessagingIdentity[],
	name: string | null | undefined,
): Promise<Result<{ id: string }>> {
	if (members.some((m) => identityKey(m) === identityKey(creator))) {
		return fail(400, "You're already in this group");
	}
	const resolved = await resolveNewMembers(members, new Set([identityKey(creator)]));
	if (!resolved.ok) return resolved;
	if (resolved.value.length === 0) return fail(400, "Add at least one member");
	if (resolved.value.length + 1 > MAX_GROUP_PARTICIPANTS) return tooMany();

	const conversation = await prisma.conversation.create({
		data: {
			kind: ConversationKind.GROUP,
			name: name?.trim() || null,
			participants: { create: [identityWhere(creator), ...resolved.value.map(identityWhere)] },
		},
		select: { id: true },
	});
	return { ok: true, value: { id: conversation.id } };
}

/** Serialize membership changes on one conversation (cap checks and last-member deletes race otherwise). */
async function lockConversation(tx: Prisma.TransactionClient, conversationId: string) {
	await tx.$queryRaw`SELECT id FROM "conversations" WHERE id = ${conversationId} FOR UPDATE`;
}

/** Add members to a GROUP. Idempotent for existing members; the cap is checked under a row lock. */
export async function addGroupMembers(conversationId: string, refs: MessagingIdentity[]): Promise<Result<{ added: number }>> {
	return prisma.$transaction(async (tx) => {
		await lockConversation(tx, conversationId);
		const existing = await tx.conversationParticipant.findMany({
			where: { conversationId },
			select: { userId: true, pageId: true },
		});
		const existingKeys = new Set(existing.map((p) => identityKey(participantIdentity(p))));
		const resolved = await resolveNewMembers(refs, existingKeys);
		if (!resolved.ok) return resolved;
		if (existing.length + resolved.value.length > MAX_GROUP_PARTICIPANTS) return tooMany();
		if (resolved.value.length > 0) {
			await tx.conversationParticipant.createMany({
				data: resolved.value.map((r) => ({ conversationId, ...identityWhere(r) })),
				skipDuplicates: true,
			});
		}
		return { ok: true as const, value: { added: resolved.value.length } };
	});
}

/** Rename (or clear the name of) a GROUP. */
export async function renameGroup(conversationId: string, name: string | null): Promise<void> {
	await prisma.conversation.update({ where: { id: conversationId }, data: { name: name?.trim() || null } });
}

/**
 * Remove the acting identity from a GROUP. When the last participant leaves, the conversation (and its
 * messages, by cascade) is deleted. Authorization (page leave is ADMIN-only) is the caller's job.
 */
export async function leaveGroup(conversationId: string, identity: MessagingIdentity): Promise<{ deletedConversation: boolean }> {
	return prisma.$transaction(async (tx) => {
		await lockConversation(tx, conversationId);
		await tx.conversationParticipant.deleteMany({ where: { conversationId, ...identityWhere(identity) } });
		const remaining = await tx.conversationParticipant.count({ where: { conversationId } });
		if (remaining === 0) {
			await tx.conversation.delete({ where: { id: conversationId } });
			return { deletedConversation: true };
		}
		return { deletedConversation: false };
	});
}
