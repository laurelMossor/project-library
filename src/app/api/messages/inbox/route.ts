import { NextResponse } from "next/server";
import { serverError } from "@/lib/utils/errors";
import { listInbox } from "@/lib/utils/server/message";
import { asPageIdFromQuery, isResponse, resolveMessagingRequest } from "@/lib/utils/server/message-routes";

/**
 * GET /api/messages/inbox?asPageId=<id>
 * Conversations (DMs and groups) for the ACTIVE identity only — personal (no asPageId) or a single page
 * the caller manages — with members, last visible message, and this identity's unread count.
 * Protected endpoint.
 */
export async function GET(request: Request) {
	try {
		const req = await resolveMessagingRequest(asPageIdFromQuery(request));
		if (isResponse(req)) return req;
		return NextResponse.json(await listInbox(req.identity));
	} catch (error) {
		console.error("GET /api/messages/inbox error:", error);
		return serverError();
	}
}
