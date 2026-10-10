"use server";

import { authedAction } from "@/lib/utils/server/action";
import { changeProfileHandle, updateProfile } from "@/lib/utils/server/profile-update";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { ProfileTarget } from "@/lib/types/profile";

/**
 * Save the signed-in user's profile, or a page they may act as (ADMIN/EDITOR; privacy and
 * membership settings are ADMIN-only). Takes the inline-edit `SavePayload` (fields plus
 * element operations). Returns the refetched profile for a client that holds its own copy;
 * a server-rendered screen just gets the refreshed page.
 */
export const saveProfileAction = authedAction(
	async (ctx, input: { target: ProfileTarget; payload: SavePayload }) =>
		updateProfile(ctx.userId, input?.target, input?.payload),
);

/**
 * Change a user's or page's handle. Separate from the profile save because it also moves
 * the cross-entity Handle row. Rate-limited to curb churn and squatting.
 */
export const setHandleAction = authedAction(
	async (ctx, input: { target: ProfileTarget; handle: string }) =>
		changeProfileHandle(ctx.userId, input?.target, input?.handle),
	{ rateLimit: { key: "handle-update", maxRequests: 5, windowMs: 60 * 60 * 1000 } },
);
