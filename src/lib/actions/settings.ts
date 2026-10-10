"use server";

import { authedAction } from "@/lib/utils/server/action";
import { resolveEmailIdentity, updatePrefs } from "@/lib/utils/server/notification-preferences";
import type { NotificationPrefs, NotificationPrefsPatch } from "@/lib/types/settings";

/**
 * Save email preferences for the identity the session is acting as (the user, or a page they
 * manage). Returns the resulting preferences. No refresh: the panel loads its own prefs and
 * takes them from this result, and nothing server-rendered shows them.
 */
export const updateNotificationPrefsAction = authedAction(
	async (ctx, input: NotificationPrefsPatch): Promise<NotificationPrefs> =>
		updatePrefs(await resolveEmailIdentity(ctx), input),
	{ refresh: false },
);
