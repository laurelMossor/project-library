import { NextResponse } from "next/server";
import { serverError } from "@/lib/utils/errors";
import { getFollowConnectedProfiles } from "@/lib/utils/server/search";
import { getViewerContext } from "@/lib/utils/server/visibility";
import { asPageIdFromQuery, isResponse, resolveMessagingRequest } from "@/lib/utils/server/message-routes";

/**
 * GET /api/messages/suggestions?asPageId=<id>
 * Suggested group members for the acting identity: profiles sharing a follow edge with it (either
 * direction). Anyone else is reachable through the regular profile search. Protected endpoint.
 */
export async function GET(request: Request) {
	try {
		const req = await resolveMessagingRequest(asPageIdFromQuery(request));
		if (isResponse(req)) return req;
		const viewer = await getViewerContext();
		return NextResponse.json({ results: await getFollowConnectedProfiles(req.identity, viewer) });
	} catch (error) {
		console.error("GET /api/messages/suggestions error:", error);
		return serverError();
	}
}
