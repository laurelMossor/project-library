"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import { setActiveIdentity } from "@/lib/utils/server/active-identity";

/**
 * Switch the identity the session acts as: a page id, or `null` for the personal profile.
 * The wrapper refreshes, so the nav and every viewer-dependent server page re-render as the
 * new identity.
 */
export const setActivePageAction = authedAction(async (ctx, input: { pageId: string | null }) => {
	const pageId = input?.pageId == null ? null : requireId(input.pageId, "page");
	await setActiveIdentity(ctx.userId, pageId);
});
