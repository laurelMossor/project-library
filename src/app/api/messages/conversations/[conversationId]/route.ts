import { NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/utils/errors";
import { advanceReadMarker, getThread } from "@/lib/utils/server/message";
import { asPageIdFromQuery, isResponse, resolveMessagingRequest } from "@/lib/utils/server/message-routes";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * GET /api/messages/conversations/:conversationId?asPageId=<id>
 * The conversation as the acting identity sees it: kind, name, members, and messages since it joined.
 * Viewing marks it read up to the newest message returned. Non-participants get 404.
 * (Sends and group edits are Server Actions in src/lib/actions/message.ts.)
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { conversationId } = await params;
		const req = await resolveMessagingRequest(asPageIdFromQuery(request));
		if (isResponse(req)) return req;

		const thread = await getThread(conversationId, req.identity, req.userId);
		if (!thread) return notFound("Conversation not found");
		// Viewing is reading. The cursor is the newest message this response actually contains, so a
		// message that lands after the load stays unread.
		const latest = thread.messages.at(-1);
		if (latest) await advanceReadMarker(conversationId, req.identity, latest.createdAt);
		return NextResponse.json(thread);
	} catch (error) {
		console.error("GET /api/messages/conversations/:id error:", error);
		return serverError();
	}
}
