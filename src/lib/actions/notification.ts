"use server";

import { authedAction } from "@/lib/utils/server/action";
import { markContextRead } from "@/lib/utils/server/notification";
import type { NotificationContextKey } from "@/lib/types/notification";

/**
 * Mark every unread notification in one identity's bell as read ("personal" or a page id). Scoped
 * to the session user, so it only ever touches the caller's own rows. The bell and its badge are
 * client-fetched, so this skips the refresh; the bell signals the badge to refetch.
 */
export const markNotificationsReadAction = authedAction(
	async (ctx, input: { context?: NotificationContextKey }) => {
		const context: NotificationContextKey = typeof input?.context === "string" ? input.context : "personal";
		await markContextRead(ctx.userId, context);
	},
	{ refresh: false },
);
