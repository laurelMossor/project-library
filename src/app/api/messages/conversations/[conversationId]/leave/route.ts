import { NextResponse } from "next/server";
import { ConversationKind } from "@prisma/client";
import { badRequest, forbidden, serverError } from "@/lib/utils/errors";
import { leaveGroup } from "@/lib/utils/server/message";
import { canManagePage } from "@/lib/utils/server/permission";
import { isResponse, readJsonBody, resolveParticipantRequest } from "@/lib/utils/server/message-routes";
import { logAction } from "@/lib/utils/server/log";
import { asPageIdOf } from "@/lib/const/messaging";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * POST /api/messages/conversations/:conversationId/leave
 * Remove the acting identity from a GROUP. Leaving as a page removes it for every manager (and a re-add
 * loses earlier history), so it's a manage action: ADMIN only. The last member out deletes the group.
 *
 * Body: { asPageId?: string }
 */
export async function POST(request: Request, { params }: Params) {
	try {
		const { conversationId } = await params;
		const body = await readJsonBody(request);
		const req = await resolveParticipantRequest(conversationId, body.asPageId);
		if (isResponse(req)) return req;

		if (req.participation.conversation.kind !== ConversationKind.GROUP) {
			return badRequest("Only group conversations can be left");
		}
		// The caller can already see this conversation (they manage the page), so 403 leaks nothing.
		if (req.identity.type === "page" && !(await canManagePage(req.userId, req.identity.id))) {
			return forbidden("Only a page admin can remove the page from a group");
		}

		const { deletedConversation } = await leaveGroup(conversationId, req.identity);
		logAction("message.group_left", req.userId, {
			conversationId,
			deletedConversation,
			asPageId: asPageIdOf(req.identity),
		});
		return NextResponse.json({ ok: true, deletedConversation });
	} catch (error) {
		console.error("POST /api/messages/conversations/:id/leave error:", error);
		return serverError();
	}
}
