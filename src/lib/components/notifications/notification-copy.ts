import type { NotificationItem } from "@/lib/types/notification";
import { resolveCardIdentity } from "@/lib/types/card";
import { notificationText } from "@/lib/utils/notification-text";

/** The actor's display name, or the guest label, or a safe fallback. */
function actorName(n: NotificationItem): string {
	if (n.actor) return resolveCardIdentity(n.actor).name;
	return n.actorName ?? "Someone";
}

/**
 * Plain-language copy for a bell row. The bell is identity-scoped, so "you / your" is always correct —
 * the viewer is acting as the notification's recipient identity. Wording lives in the shared
 * `notificationText` builder so the bell and the email channel never drift.
 */
export function notificationMessage(n: NotificationItem): string {
	return notificationText({
		type: n.type,
		actorName: actorName(n),
		objectType: n.objectType,
		objectTitle: n.objectTitle,
	});
}
