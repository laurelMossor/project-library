import { NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/utils/errors";
import { markConversationRead } from "@/lib/utils/server/message";
import { isResponse, readJsonBody, resolveMessagingRequest } from "@/lib/utils/server/message-routes";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * PATCH /api/messages/conversations/:conversationId/read
 * Mark the conversation read for the acting identity only — other members' unread is untouched. A page
 * identity's marker is shared by all of that page's managers. Non-participants get 404.
 *
 * Body: { asPageId?: string, upToMessageId?: string } — the newest message the viewer loaded; the
 * marker never jumps past what was actually seen.
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const { conversationId } = await params;
		const body = await readJsonBody(request);
		const req = await resolveMessagingRequest(body.asPageId);
		if (isResponse(req)) return req;

		const upTo = typeof body.upToMessageId === "string" ? body.upToMessageId : null;
		if (!(await markConversationRead(conversationId, req.identity, upTo))) {
			return notFound("Conversation not found");
		}
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("PATCH /api/messages/conversations/:id/read error:", error);
		return serverError();
	}
}
