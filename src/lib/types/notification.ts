import type { CardEntity } from "./card";
import type { NotificationType, NotificationObject } from "@prisma/client";

// Schema is the source of truth — re-export the Prisma enums so client code imports them from here.
export type { NotificationType, NotificationObject };

/**
 * A single notification row, hydrated for the bell. Mirrors the server
 * `getNotificationsForUser` shape (actor hydrated via the attribution-only embed selectors,
 * `href` computed server-side).
 *
 * The bell is identity-scoped, so the viewer is always acting as the relevant identity — copy can
 * safely say "your post" / "your page" in every context.
 */
export interface NotificationItem {
	id: string;
	type: NotificationType;
	createdAt: Date | string;
	readAt: Date | string | null;

	/** Who caused it: a hydrated user/page (assignable to CardEntity for ProfileTag/Picture), or null for a guest RSVP. */
	actor: CardEntity | null;
	/** Display name when there's no account actor (guest RSVP). Exactly one of `actor`/`actorName` is set. */
	actorName: string | null;

	/** What the notification is about (drives "post" vs "event" in copy). Null when there's no object. */
	objectType: NotificationObject | null;
	/** Title of the post/event the notification is about, for copy. Null for page objects / titleless posts. */
	objectTitle: string | null;
	/** Precomputed deep link (post/event detail, a profile, or the Requests tab). */
	href: string;
}

/** The identity lens a bell request is scoped to: personal, or a specific managed page. */
export type NotificationContextKey = "personal" | (string & {});

/** Per-identity unread counts — same shape as the messages unread-count endpoint. */
export interface NotificationCounts {
	personal: number;
	pages: Record<string, number>;
}
