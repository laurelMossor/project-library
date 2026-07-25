import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { setUserHandle } from "@/lib/utils/server/handle";

/**
 * PUT /api/me/handle
 * Change the current user's handle. Kept off the generic profile-save path because a handle
 * change must also update the cross-entity `Handle` namespace row (see setUserHandle), which
 * the field-copying profile updater doesn't touch. Rate-limited to curb churn/squatting.
 */
export async function PUT(request: Request) {
	const session = await auth();
	if (!session?.user?.id) {
		return unauthorized();
	}

	const limited = await enforceRateLimit(
		request,
		"handle-update",
		{ maxRequests: 5, windowMs: 60 * 60 * 1000 },
		"Too many handle changes. Please try again in a bit.",
	);
	if (limited) return limited;

	const { handle } = await request.json().catch(() => ({}));
	if (typeof handle !== "string") {
		return badRequest("Handle is required");
	}

	const result = await setUserHandle(session.user.id, handle);
	if (!result.ok) {
		return badRequest(result.error);
	}
	return NextResponse.json({ handle: result.handle });
}
