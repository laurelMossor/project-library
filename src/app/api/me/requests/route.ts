import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";
import { listIncomingFollowRequests } from "@/lib/utils/server/requests";

/**
 * GET /api/me/requests
 * The current user's own incoming follow requests (for a private profile),
 * with a count for the badge.
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const requests = await listIncomingFollowRequests(ctx.userId);
		return NextResponse.json({ requests, count: requests.length });
	} catch (error) {
		console.error("GET /api/me/requests error:", error);
		return serverError("Failed to fetch requests");
	}
}
