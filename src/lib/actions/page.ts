"use server";

import { authedAction, requireId } from "@/lib/utils/server/action";
import { createPageFromInput } from "@/lib/utils/server/page-create";
import { removePage } from "@/lib/utils/server/page";
import type { PageCreateInput } from "@/lib/types/page";

/** Create a page (the creator becomes its admin). The caller navigates to it, so no refresh. */
export const createPageAction = authedAction(
	async (ctx, input: PageCreateInput): Promise<{ id: string; handle: string }> => createPageFromInput(ctx.userId, input),
	{ refresh: false },
);

/**
 * Delete a page you administer. No refresh: the caller leaves the page's settings, and
 * re-rendering a deleted page's own screen would fail first.
 */
export const deletePageAction = authedAction(
	async (ctx, input: { id: string }) => {
		await removePage(ctx.userId, requireId(input?.id, "page"));
	},
	{ refresh: false },
);
