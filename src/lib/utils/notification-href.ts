// Isomorphic (no prisma): maps a notification to its deep link. Switches on the NotificationObject
// enum — never string literals. Kept out of the read query so the client row stays dumb.
import { NotificationType, NotificationObject } from "@prisma/client";
import { POST_DETAIL, EVENT_DETAIL, PUBLIC_PROFILE, CONNECTIONS_REQUESTS, CONNECTIONS } from "@/lib/const/routes";

export interface NotificationHrefInput {
	type: NotificationType;
	objectType: NotificationObject | null;
	objectId: string | null;
	/** Hydrated handle of the actor (for the follow/join/approved types that link to a profile). */
	actorHandle: string | null;
}

/** The deep link a notification row navigates to when clicked. */
export function notificationHref({ type, objectType, objectId, actorHandle }: NotificationHrefInput): string {
	switch (type) {
		case NotificationType.COMMENT:
			if (!objectId) return CONNECTIONS; // defensive; a comment always carries its object
			return objectType === NotificationObject.EVENT ? EVENT_DETAIL(objectId) : POST_DETAIL(objectId);
		case NotificationType.RSVP:
			return objectId ? EVENT_DETAIL(objectId) : CONNECTIONS;
		case NotificationType.NEW_FOLLOWER:
		case NotificationType.NEW_MEMBER:
		case NotificationType.REQUEST_APPROVED:
			return actorHandle ? PUBLIC_PROFILE(actorHandle) : CONNECTIONS;
		case NotificationType.FOLLOW_REQUEST:
		case NotificationType.JOIN_REQUEST:
			return CONNECTIONS_REQUESTS;
		default:
			return CONNECTIONS;
	}
}
