// Single source of truth for notification wording. Both the in-app bell (notification-copy.ts) and the
// email channel (the flush → NotificationEmail) build their text here, so the two never drift. Pure and
// import-safe on client and server — takes primitive fields, resolves no identities.

import type { NotificationType, NotificationObject } from "@prisma/client";

export interface NotificationTextInput {
	type: NotificationType | string;
	/** Already-resolved actor display name (or a guest label / "Someone"). */
	actorName: string;
	objectType?: NotificationObject | null;
	objectTitle?: string | null;
	/** Set when the recipient is a page (the bell is scoped to it): names who was addressed instead of "you". */
	recipientPageName?: string | null;
}

/** `"post"` / `"event"`; defaults to post. */
function objectNoun(objectType?: NotificationObject | null): string {
	return objectType === "EVENT" ? "event" : "post";
}

/** A quoted title suffix, or empty. */
function titled(title?: string | null): string {
	return title ? ` “${title}”` : "";
}

/** "Admin" → "an", "Member" → "a". */
export function articleFor(word: string): "a" | "an" {
	return /^[aeiou]/i.test(word) ? "an" : "a";
}

/**
 * Plain-language text for one notification, from the recipient's point of view ("you / your"). Correct
 * for the identity-scoped bell and for a profile-scoped email section, since both address the recipient
 * identity directly.
 */
export function notificationText(n: NotificationTextInput): string {
	const who = n.actorName;
	switch (n.type) {
		case "COMMENT":
			return `${who} commented on your ${objectNoun(n.objectType)}${titled(n.objectTitle)}`;
		case "FOLLOW_REQUEST":
			return `${who} asked to follow you`;
		case "JOIN_REQUEST":
			return `${who} asked to join your page`;
		case "NEW_FOLLOWER":
			return `${who} started following you`;
		case "NEW_MEMBER":
			return `${who} joined your page`;
		case "RSVP":
			return `${who} RSVP’d to your event${titled(n.objectTitle)}`;
		case "REQUEST_APPROVED":
			return `${who} accepted your request`;
		case "MEMBER_INVITE": {
			const role = n.objectTitle?.trim();
			if (!role) return `${who} invited you to join their page`;
			return `${who} invited you to be ${articleFor(role)} ${role} on their page`;
		}
		case "ROLE_CHANGED":
			return `${who} changed your role`;
		case "MENTION":
			return `${who} tagged ${n.recipientPageName ?? "you"} in a comment`;
		default:
			return `${who} sent you a notification`;
	}
}

/** A second line under a bell row, when that notification asks the recipient to act. */
export function notificationPrompt(type: NotificationType | string): string | null {
	if (type === "MEMBER_INVITE") return "Approve or Decline?";
	return null;
}
