import type { NotificationItem } from "@/lib/types/notification";
import { resolveCardIdentity } from "@/lib/types/card";

/** The actor's display name, or the guest label, or a safe fallback. */
function actorName(n: NotificationItem): string {
	if (n.actor) return resolveCardIdentity(n.actor).name;
	return n.actorName ?? "Someone";
}

/** `"post"` / `"event"` for copy; defaults to post. */
function objectNoun(n: NotificationItem): string {
	return n.objectType === "EVENT" ? "event" : "post";
}

/** A quoted title suffix, or empty. */
function titled(n: NotificationItem): string {
	return n.objectTitle ? ` “${n.objectTitle}”` : "";
}

/**
 * Plain-language copy for a bell row. The bell is identity-scoped, so "you / your" is always
 * correct — the viewer is acting as the notification's recipient identity.
 */
export function notificationMessage(n: NotificationItem): string {
	const who = actorName(n);
	switch (n.type) {
		case "COMMENT":
			return `${who} commented on your ${objectNoun(n)}${titled(n)}`;
		case "FOLLOW_REQUEST":
			return `${who} asked to follow you`;
		case "JOIN_REQUEST":
			return `${who} asked to join your page`;
		case "NEW_FOLLOWER":
			return `${who} started following you`;
		case "NEW_MEMBER":
			return `${who} joined your page`;
		case "RSVP":
			return `${who} RSVP’d to your event${titled(n)}`;
		case "REQUEST_APPROVED":
			return `${who} accepted your request`;
		default:
			return `${who} sent you a notification`;
	}
}
