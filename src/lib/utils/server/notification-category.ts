// Maps in-app notification types to the user-facing email preference categories, and the per-category
// email default when a user has no stored preference row.
//
// The MESSAGES category has no NotificationType — direct messages are a separate model and enqueue for
// email directly (see the message-send route), so they are not in the type→category map.

import { NotificationType, NotificationCategory } from "@prisma/client";

// Exhaustive over NotificationType: `Record<NotificationType, …>` makes a newly-added notification type
// a compile error here until it's categorized — the schema stays the source of truth.
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
	[NotificationType.COMMENT]: NotificationCategory.COMMENTS,
	[NotificationType.FOLLOW_REQUEST]: NotificationCategory.REQUESTS,
	[NotificationType.JOIN_REQUEST]: NotificationCategory.REQUESTS,
	[NotificationType.REQUEST_APPROVED]: NotificationCategory.REQUESTS,
	[NotificationType.NEW_FOLLOWER]: NotificationCategory.FOLLOWS,
	[NotificationType.NEW_MEMBER]: NotificationCategory.FOLLOWS,
	[NotificationType.RSVP]: NotificationCategory.RSVPS,
};

// Effective on/off for a category when the identity has no stored NotificationPreference row.
// Actionable + direct engagement default on; passive (follows/new members) and high-volume (RSVPs)
// default off — opt-in.
export const CATEGORY_EMAIL_DEFAULT: Record<NotificationCategory, boolean> = {
	[NotificationCategory.COMMENTS]: true,
	[NotificationCategory.REQUESTS]: true,
	[NotificationCategory.FOLLOWS]: false,
	[NotificationCategory.MESSAGES]: true,
	[NotificationCategory.RSVPS]: false,
};
