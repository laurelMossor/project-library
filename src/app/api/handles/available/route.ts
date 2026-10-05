import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { handleUnavailableReason } from "@/lib/utils/server/handle";

/**
 * GET /api/handles/available?handle=
 * Public, because the signup form asks before an account exists. Handles are already public
 * URLs, so this reveals nothing new; it's rate-limited to stop bulk probing.
 */
export async function GET(request: Request) {
	const limited = await enforceRateLimit(
		request,
		"handle-available",
		{ maxRequests: 60, windowMs: 60 * 1000 },
		"Too many checks. Slow down a little.",
	);
	if (limited) return limited;

	const handle = (new URL(request.url).searchParams.get("handle") ?? "").trim().toLowerCase();
	const reason = await handleUnavailableReason(handle);
	return NextResponse.json(reason ? { available: false, reason } : { available: true });
}
