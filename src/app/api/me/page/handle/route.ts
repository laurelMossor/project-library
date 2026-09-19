import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, forbidden } from "@/lib/utils/errors";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { setPageHandle } from "@/lib/utils/server/handle";

/**
 * PUT /api/me/page/handle
 * Change the ACTIVE page's handle. The page counterpart to PUT /api/me/handle — kept off the
 * generic page-profile save (PUT /api/me/page) because a handle change must also update the
 * cross-entity `Handle` namespace row (see setPageHandle), which the profile updater doesn't
 * touch. Gated to act-as-page (ADMIN/EDITOR), matching who may edit the page's name, and
 * rate-limited to curb churn/squatting.
 */
export async function PUT(request: Request) {
	const ctx = await getSessionContext();
	if (!ctx) {
		return unauthorized();
	}

	if (!ctx.activePageId) {
		return badRequest("No active page set. Cannot update page handle.");
	}

	const allowed = await canPostAsPage(ctx.userId, ctx.activePageId);
	if (!allowed) {
		return forbidden("You don't have permission to manage this page");
	}

	const limited = await enforceRateLimit(
		request,
		"page-handle-update",
		{ maxRequests: 5, windowMs: 60 * 60 * 1000 },
		"Too many handle changes. Please try again in a bit.",
	);
	if (limited) return limited;

	const { handle } = await request.json().catch(() => ({}));
	if (typeof handle !== "string") {
		return badRequest("Handle is required");
	}

	const result = await setPageHandle(ctx.activePageId, handle);
	if (!result.ok) {
		return badRequest(result.error);
	}
	return NextResponse.json({ handle: result.handle });
}
