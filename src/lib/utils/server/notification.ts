// ⚠️ SERVER-ONLY: Notification persistence + read layer.
//
// The dispatcher (activity.ts) writes rows here; the /api/notifications routes read them. Every
// read/write is scoped to a (recipientUserId, context) pair — that scoping is the security
// boundary. Actor + object are hydrated at read time via the attribution-only embed selectors.

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { publicUserEmbedFields } from "./user";
import { publicPageEmbedFields } from "./fields";
import { notificationHref } from "@/lib/utils/notification-href";
import { canViewPost, canViewEvent, type ViewerContext } from "./visibility";
import type { CardUser, CardPage } from "@/lib/types/card";
import type { NotificationItem, NotificationContextKey, NotificationCounts } from "@/lib/types/notification";

const DEFAULT_LIMIT = 30;

/** The (recipient, identity) filter — "personal" → the user's own bell, else a managed page's bell. */
function contextWhere(recipientUserId: string, context: NotificationContextKey) {
	return { recipientUserId, contextPageId: context === "personal" ? null : context };
}

/** Write the fan-out rows for one activity. Called by the dispatcher. */
export async function createNotifications(rows: Prisma.NotificationCreateManyInput[]): Promise<void> {
	if (rows.length === 0) return;
	await prisma.notification.createMany({ data: rows });
}

/** Per-identity unread counts for the bell + profile-switcher dots (same shape as messages). */
export async function getUnreadCounts(recipientUserId: string): Promise<NotificationCounts> {
	const groups = await prisma.notification.groupBy({
		by: ["contextPageId"],
		where: { recipientUserId, readAt: null },
		_count: { _all: true },
	});
	const counts: NotificationCounts = { personal: 0, pages: {} };
	for (const g of groups) {
		if (g.contextPageId === null) counts.personal = g._count._all;
		else counts.pages[g.contextPageId] = g._count._all;
	}
	return counts;
}

/** Mark every unread notification in one identity's bell as read. */
export async function markContextRead(recipientUserId: string, context: NotificationContextKey): Promise<void> {
	await prisma.notification.updateMany({
		where: { ...contextWhere(recipientUserId, context), readAt: null },
		data: { readAt: new Date() },
	});
}

const notificationRowSelect = {
	id: true,
	createdAt: true,
	readAt: true,
	type: true,
	actorUserId: true,
	actorPageId: true,
	actorName: true,
	objectType: true,
	objectId: true,
} as const;

/** The latest notifications for one identity's bell, hydrated (actor, object title, deep link). */
export async function getNotificationsForUser(
	recipientUserId: string,
	context: NotificationContextKey,
	viewer: ViewerContext,
	limit = DEFAULT_LIMIT,
): Promise<NotificationItem[]> {
	const rows = await prisma.notification.findMany({
		where: contextWhere(recipientUserId, context),
		orderBy: { createdAt: "desc" },
		take: limit,
		select: notificationRowSelect,
	});
	if (rows.length === 0) return [];

	// Batch-hydrate actors (users + pages) via the attribution-only selectors.
	const userIds = [...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => !!id))];
	const pageIds = [...new Set(rows.map((r) => r.actorPageId).filter((id): id is string => !!id))];
	const [users, pages] = await Promise.all([
		userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: publicUserEmbedFields }) : [],
		pageIds.length ? prisma.page.findMany({ where: { id: { in: pageIds } }, select: publicPageEmbedFields }) : [],
	]);
	const userMap = new Map(users.map((u) => [u.id, u as CardUser]));
	const pageMap = new Map(pages.map((p) => [p.id, p as CardPage]));

	// Batch-hydrate object titles (POST/EVENT only; PAGE objects need no title in the identity-scoped
	// copy). Gated through the visibility layer with the recipient AS the viewer: today every emitter
	// notifies the object's owner, but a future emitter that targets a non-owner must not leak a
	// PRIVATE/draft title — so a title the viewer can't see is dropped. Non-PRIVATE content
	// short-circuits `true`, keeping the common path query-free.
	const postIds = rows.filter((r) => r.objectType === "POST" && r.objectId).map((r) => r.objectId!);
	const eventIds = rows.filter((r) => r.objectType === "EVENT" && r.objectId).map((r) => r.objectId!);
	const [posts, events] = await Promise.all([
		postIds.length
			? prisma.post.findMany({
				where: { id: { in: postIds } },
				select: { id: true, userId: true, pageId: true, eventId: true, contentVisibility: true, title: true },
			})
			: [],
		eventIds.length
			? prisma.event.findMany({
				where: { id: { in: eventIds } },
				select: { id: true, userId: true, pageId: true, contentVisibility: true, title: true },
			})
			: [],
	]);
	const [viewablePosts, viewableEvents] = await Promise.all([
		Promise.all(posts.map(async (p) => ((await canViewPost(p, viewer)) ? p : null))),
		Promise.all(events.map(async (e) => ((await canViewEvent(e, viewer)) ? e : null))),
	]);
	const titleMap = new Map<string, string | null>([
		...viewablePosts.filter((p): p is NonNullable<typeof p> => !!p).map((p) => [p.id, p.title] as const),
		...viewableEvents.filter((e): e is NonNullable<typeof e> => !!e).map((e) => [e.id, e.title] as const),
	]);

	return rows.map((r): NotificationItem => {
		const actor: CardUser | CardPage | null = r.actorUserId
			? userMap.get(r.actorUserId) ?? null
			: r.actorPageId
				? pageMap.get(r.actorPageId) ?? null
				: null;
		const actorHandle = actor?.handle ?? null;
		return {
			id: r.id,
			type: r.type,
			createdAt: r.createdAt,
			readAt: r.readAt,
			actor,
			actorName: r.actorName,
			objectType: r.objectType,
			objectTitle: r.objectId ? titleMap.get(r.objectId) ?? null : null,
			href: notificationHref({ type: r.type, objectType: r.objectType, objectId: r.objectId, actorHandle }),
		};
	});
}
