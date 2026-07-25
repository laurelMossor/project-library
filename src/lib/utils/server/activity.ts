// ⚠️ SERVER-ONLY: Activity notification dispatcher.
//
// The single choke point for "something happened that a user might want to be notified about" — a
// comment, a follow, a join request, an RSVP, a request approval. Features call emitActivity(); it
// resolves recipients, fans out to per-user notification rows, and persists them.
//
// Model: Activity Streams actor · verb · object, one delivery per row, identity-scoped. Full
// rationale: docs/scratch/ACTIVITY_NOTIFICATIONS_PRD.md.

import type { Prisma } from "@prisma/client";
import { NotificationType, NotificationObject, PermissionRole, ResourceType, EmailSourceType } from "@prisma/client";
import { logAction } from "./log";
import { getResourcePermissions } from "./permission";
import { ACTING_ROLES, ADMIN_ONLY } from "@/lib/const/roles";
import { createNotifications } from "./notification";
import { enqueueEmails } from "./email-outbox";
import { NOTIFICATION_TYPE_TO_CATEGORY } from "./notification-category";

/** An identity that is a user or a page. */
export type EntityRef = { type: "USER" | "PAGE"; id: string };
/** Who caused an activity: a user/page identity, or an account-less actor carrying a display label (guest RSVP). */
export type ActorRef = EntityRef | { type: "ANON"; label: string };
/** What an activity is about, for the deep link. Kinds come from the schema enum — never string literals. */
export type ObjectRef = { type: NotificationObject; id: string };

/** Maps the dotted action strings the call sites already emit to a persisted notification type. */
const ACTION_TO_TYPE: Record<string, NotificationType> = {
	"comment.created": NotificationType.COMMENT,
	"follow.requested": NotificationType.FOLLOW_REQUEST,
	"membership.requested": NotificationType.JOIN_REQUEST,
	"follow.created": NotificationType.NEW_FOLLOWER,
	"membership.joined": NotificationType.NEW_MEMBER,
	"rsvp.created": NotificationType.RSVP,
	"request.approved": NotificationType.REQUEST_APPROVED,
};

/** Request types target a gated action (approval), so they reach only those who can act — ADMINs. */
const REQUEST_TYPES: ReadonlySet<NotificationType> = new Set([
	NotificationType.FOLLOW_REQUEST,
	NotificationType.JOIN_REQUEST,
]);

/** Which page roles receive a given type: request types → ADMIN only; informational → ADMIN + EDITOR. */
function rolesForType(type: NotificationType): readonly PermissionRole[] {
	return REQUEST_TYPES.has(type) ? ADMIN_ONLY : ACTING_ROLES;
}

/** The actor columns for a notification row, from an ActorRef. */
function actorColumns(actor: ActorRef): Pick<Prisma.NotificationCreateManyInput, "actorUserId" | "actorPageId" | "actorName"> {
	if (actor.type === "ANON") return { actorName: actor.label };
	if (actor.type === "USER") return { actorUserId: actor.id };
	return { actorPageId: actor.id };
}

/**
 * Resolve the fan-out rows for one activity. A USER target yields one personal row; a PAGE target
 * yields one row per managing user (filtered by role), each tagged with contextPageId so the bell
 * can scope to the active identity. Self-notifications (actor === recipient user) are dropped.
 */
async function resolveRecipients(
	type: NotificationType,
	target: EntityRef,
	actor: ActorRef,
	object: ObjectRef | undefined,
): Promise<Prisma.NotificationCreateManyInput[]> {
	const base = {
		type,
		...actorColumns(actor),
		objectType: object?.type ?? null,
		objectId: object?.id ?? null,
	};

	let recipients: { recipientUserId: string; contextPageId: string | null }[];
	if (target.type === "USER") {
		recipients = [{ recipientUserId: target.id, contextPageId: null }];
	} else {
		const roles = rolesForType(type);
		const perms = await getResourcePermissions(target.id, ResourceType.PAGE);
		recipients = perms
			.filter((p) => roles.includes(p.role))
			.map((p) => ({ recipientUserId: p.userId, contextPageId: target.id }));
	}

	// Drop self-notifications — only meaningful for a USER actor (a page-actor's human is unknown).
	const selfUserId = actor.type === "USER" ? actor.id : null;
	return recipients
		.filter((r) => r.recipientUserId !== selfUserId)
		.map((r) => ({ ...base, ...r }));
}

/**
 * Record that `actor` did `action` toward `target` (optionally about `object`), persisting a
 * notification per recipient AND enqueuing an email per recipient. Awaited by callers so the writes are
 * guaranteed in-request, but NEVER throws — a dispatch failure logs and is swallowed so it can't roll
 * back or 500 the triggering action. Email delivery is deferred: enqueue is a cheap local insert; the
 * scheduled flush (email-flush.ts) applies preferences + read-suppression and actually sends.
 */
export async function emitActivity(
	action: string,
	actor: ActorRef,
	target: EntityRef,
	object?: ObjectRef,
): Promise<void> {
	logAction(action, actor.type === "USER" ? actor.id : undefined, { actor, target, object });
	try {
		const type = ACTION_TO_TYPE[action];
		if (!type) {
			if (process.env.NODE_ENV !== "production") {
				console.warn(`emitActivity: unmapped action "${action}" — no notification written`);
			}
			return;
		}
		const rows = await resolveRecipients(type, target, actor, object);
		if (rows.length === 0) return;
		const created = await createNotifications(rows);
		// Enqueue one email per created notification (its recipient identity + mapped category). The email
		// set matches the bell set for free — same rows, already role-filtered + self-filtered above.
		await enqueueEmails(
			created.map((n) => ({
				recipientUserId: n.recipientUserId,
				contextPageId: n.contextPageId,
				category: NOTIFICATION_TYPE_TO_CATEGORY[n.type],
				sourceType: EmailSourceType.NOTIFICATION,
				sourceId: n.id,
			})),
		);
	} catch (err) {
		logAction("activity.dispatch_failed", undefined, { action, error: String(err) });
	}
}
