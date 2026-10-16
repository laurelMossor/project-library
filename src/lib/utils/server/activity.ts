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
import { ACTING_ROLES, ADMIN_ONLY, ALL_ROLES } from "@/lib/const/roles";
import { createNotifications } from "./notification";
import { enqueueEmails } from "./email-outbox";
import { NOTIFICATION_TYPE_TO_CATEGORY } from "./notification-category";
import { filterUsersWhoCanView } from "./visibility";

/** An identity that is a user or a page. */
export type EntityRef = { type: "USER" | "PAGE"; id: string };/** Who caused an activity: a user/page identity, or an account-less actor carrying a display label (guest RSVP). */
export type ActorRef = EntityRef | { type: "ANON"; label: string };
/**
 * What an activity is about, for the deep link. Kinds come from the schema enum — never string literals.
 * `commentId` anchors the link to one comment within that post/event (comment + mention activities).
 */
export type ObjectRef = { type: NotificationObject; id: string; commentId?: string };
/** An invite has no deep-link object; the offered role is stored on the row so the copy can name it. */
export type RoleRef = { role: PermissionRole };
export type ActivityObject = ObjectRef | RoleRef;
/** `authorUserId`: the human who caused it, when the actor is a page — never notified of their own act. */
export type ActivityOptions = { authorUserId?: string };

type ObjectColumns = Pick<Prisma.NotificationCreateManyInput, "objectType" | "objectId" | "commentId">;

/** objectType/objectId/commentId columns for a notification row. A role ref stores the role in objectId only. */
function objectColumns(object: ActivityObject | undefined): ObjectColumns {
	if (!object) return { objectType: null, objectId: null, commentId: null };
	if ("role" in object) return { objectType: null, objectId: object.role, commentId: null };
	return { objectType: object.type, objectId: object.id, commentId: object.commentId ?? null };
}

/** Maps the dotted action strings the call sites already emit to a persisted notification type. */
const ACTION_TO_TYPE: Record<string, NotificationType> = {
	"comment.created": NotificationType.COMMENT,
	"follow.requested": NotificationType.FOLLOW_REQUEST,
	"membership.requested": NotificationType.JOIN_REQUEST,
	"follow.created": NotificationType.NEW_FOLLOWER,
	"membership.joined": NotificationType.NEW_MEMBER,
	"rsvp.created": NotificationType.RSVP,
	"request.approved": NotificationType.REQUEST_APPROVED,
	"membership.invited": NotificationType.MEMBER_INVITE,
	"role.changed": NotificationType.ROLE_CHANGED,
	"comment.mentioned": NotificationType.MENTION,
	"content.published": NotificationType.PAGE_ACTIVITY,
};

/**
 * Who on a PAGE target hears about an activity, and in which bell (the activity's audience, kept
 * separate from its target, as in Activity Streams):
 *   ADMINS   → ADMIN only, in the page's bell. For requests, which only an admin can approve.
 *   MANAGERS → ADMIN + EDITOR, in the page's bell. They act for the page.
 *   MEMBERS  → every role, in each person's personal bell. They're told as themselves.
 */
type PageAudience = "ADMINS" | "MANAGERS" | "MEMBERS";

const AUDIENCE_ROLES: Record<PageAudience, readonly PermissionRole[]> = {
	ADMINS: ADMIN_ONLY,
	MANAGERS: ACTING_ROLES,
	MEMBERS: ALL_ROLES,
};

/**
 * Per-type delivery policy. Exhaustive over NotificationType, so a new type is a compile error here
 * until its audience is decided. `viewGated`: the recipient is NOT the object's owner, so each one is
 * checked against the object's visibility and dropped if they can't view it. A tag or a page post must
 * never leak a PRIVATE post/event, or deep-link someone into a 404. Owner-targeted types skip this:
 * the owner can always see their own content.
 */
const NOTIFICATION_POLICY: Record<NotificationType, { pageAudience: PageAudience; viewGated: boolean }> = {
	[NotificationType.COMMENT]: { pageAudience: "MANAGERS", viewGated: false },
	[NotificationType.FOLLOW_REQUEST]: { pageAudience: "ADMINS", viewGated: false },
	[NotificationType.JOIN_REQUEST]: { pageAudience: "ADMINS", viewGated: false },
	[NotificationType.NEW_FOLLOWER]: { pageAudience: "MANAGERS", viewGated: false },
	[NotificationType.NEW_MEMBER]: { pageAudience: "MANAGERS", viewGated: false },
	[NotificationType.RSVP]: { pageAudience: "MANAGERS", viewGated: false },
	[NotificationType.REQUEST_APPROVED]: { pageAudience: "MANAGERS", viewGated: false },
	[NotificationType.MEMBER_INVITE]: { pageAudience: "MANAGERS", viewGated: false },
	[NotificationType.ROLE_CHANGED]: { pageAudience: "MANAGERS", viewGated: false },
	[NotificationType.MENTION]: { pageAudience: "MANAGERS", viewGated: true },
	[NotificationType.PAGE_ACTIVITY]: { pageAudience: "MEMBERS", viewGated: true },
};

/** The actor columns for a notification row, from an ActorRef. */
function actorColumns(actor: ActorRef): Pick<Prisma.NotificationCreateManyInput, "actorUserId" | "actorPageId" | "actorName"> {
	if (actor.type === "ANON") return { actorName: actor.label };
	if (actor.type === "USER") return { actorUserId: actor.id };
	return { actorPageId: actor.id };
}

/**
 * Resolve the fan-out rows for one activity. A USER target yields one personal row; a PAGE target
 * yields one row per user in the type's page audience (see NOTIFICATION_POLICY): managers' rows are
 * tagged with contextPageId so the bell scopes to that page, and members' rows go to their personal
 * bell. Self-notifications (actor === recipient user) are dropped.
 */
async function resolveRecipients(
	type: NotificationType,
	target: EntityRef,
	actor: ActorRef,
	object: ActivityObject | undefined,
	options: ActivityOptions | undefined,
): Promise<Prisma.NotificationCreateManyInput[]> {
	const base = {
		type,
		...actorColumns(actor),
		...objectColumns(object),
	};

	const policy = NOTIFICATION_POLICY[type];
	let recipients: { recipientUserId: string; contextPageId: string | null }[];
	if (target.type === "USER") {
		recipients = [{ recipientUserId: target.id, contextPageId: null }];
	} else {
		const roles = AUDIENCE_ROLES[policy.pageAudience];
		const contextPageId = policy.pageAudience === "MEMBERS" ? null : target.id;
		const perms = await getResourcePermissions(target.id, ResourceType.PAGE);
		recipients = perms
			.filter((p) => roles.includes(p.role))
			.map((p) => ({ recipientUserId: p.userId, contextPageId }));
	}

	// Drop self-notifications: the USER actor, and — when the caller knows it — the human behind a
	// page actor (someone commenting as a page never hears about their own words).
	const selfUserIds = new Set([actor.type === "USER" ? actor.id : null, options?.authorUserId ?? null]);
	recipients = recipients.filter((r) => !selfUserIds.has(r.recipientUserId));

	// Non-owner recipients only hear about objects they can see (see NOTIFICATION_POLICY).
	if (policy.viewGated) {
		if (!object || "role" in object || object.type === NotificationObject.PAGE) return [];
		const viewers = await filterUsersWhoCanView(
			{ type: object.type, id: object.id },
			recipients.map((r) => r.recipientUserId),
		);
		recipients = recipients.filter((r) => viewers.has(r.recipientUserId));
	}

	return recipients.map((r) => ({ ...base, ...r }));
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
	object?: ActivityObject,
	options?: ActivityOptions,
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
		const rows = await resolveRecipients(type, target, actor, object, options);
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
