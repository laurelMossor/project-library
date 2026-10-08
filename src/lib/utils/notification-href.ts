// Isomorphic (no prisma): maps a notification to its deep link. Switches on the NotificationObject
// enum — never string literals. Kept out of the read query so the client row stays dumb.
import { NotificationType, NotificationObject } from "@prisma/client";
import { POST_DETAIL, EVENT_DETAIL, PUBLIC_PROFILE, CONNECTIONS_REQUESTS, CONNECTIONS_MEMBERSHIP, CONNECTIONS, COMMENT_LINK } from "@/lib/const/routes";

export interface NotificationHrefInput {
	type: NotificationType;
	objectType: NotificationObject | null;
	objectId: string | null;
	/** The comment within the post/event to scroll to (COMMENT / MENTION), when known. */
	commentId?: string | null;
	/** Hydrated handle of the actor (for the follow/join/approved types that link to a profile). */
	actorHandle: string | null;
}

/** The deep link a notification row navigates to when clicked. */
export function notificationHref({ type, objectType, objectId, commentId, actorHandle }: NotificationHrefInput): string {
	switch (type) {
		case NotificationType.COMMENT:
		case NotificationType.MENTION: {
			if (!objectId) return CONNECTIONS; // defensive; a comment always carries its object
			const detail = objectType === NotificationObject.EVENT ? EVENT_DETAIL(objectId) : POST_DETAIL(objectId);
			return commentId ? COMMENT_LINK(detail, commentId) : detail;
		}
		case NotificationType.RSVP:
			return objectId ? EVENT_DETAIL(objectId) : CONNECTIONS;
		case NotificationType.NEW_FOLLOWER:
		case NotificationType.NEW_MEMBER:
		case NotificationType.REQUEST_APPROVED:
			return actorHandle ? PUBLIC_PROFILE(actorHandle) : CONNECTIONS;
		case NotificationType.FOLLOW_REQUEST:
		case NotificationType.JOIN_REQUEST:
			return CONNECTIONS_REQUESTS;
		case NotificationType.MEMBER_INVITE:
		case NotificationType.ROLE_CHANGED:
			return CONNECTIONS_MEMBERSHIP;
		default:
			return CONNECTIONS;
	}
}
