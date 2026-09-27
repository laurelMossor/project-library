import { NextResponse } from "next/server";
import { ConversationKind } from "@prisma/client";
import { badRequest, notFound, serverError } from "@/lib/utils/errors";
import { validateGroupMemberRefs, validateGroupName } from "@/lib/validations";
import { addGroupMembers, getThread, renameGroup } from "@/lib/utils/server/message";
import {
	asPageIdFromQuery,
	failureResponse,
	isResponse,
	readJsonBody,
	resolveMessagingRequest,
	resolveParticipantRequest,
} from "@/lib/utils/server/message-routes";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * GET /api/messages/conversations/:conversationId?asPageId=<id>
 * The conversation as the acting identity sees it: kind, name, members, and messages since it joined.
 * Non-participants get 404.
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { conversationId } = await params;
		const req = await resolveMessagingRequest(asPageIdFromQuery(request));
		if (isResponse(req)) return req;

		const thread = await getThread(conversationId, req.identity, req.userId);
		if (!thread) return notFound("Conversation not found");
		return NextResponse.json(thread);
	} catch (error) {
		console.error("GET /api/messages/conversations/:id error:", error);
		return serverError();
	}
}

/**
 * PATCH /api/messages/conversations/:conversationId
 * Edit a GROUP: rename and/or add members. Any participant may do either (no roles in the MVP).
 *
 * Body: { asPageId?: string, name?: string | null, addMembers?: { type, id }[] }
 */
export async function PATCH(request: Request, { params }: Params) {
	const limited = await enforceRateLimit(request, "group-edit", { maxRequests: 30, windowMs: 60 * 60 * 1000 });
	if (limited) return limited;

	try {
		const { conversationId } = await params;
		const body = await readJsonBody(request);
		const req = await resolveParticipantRequest(conversationId, body.asPageId);
		if (isResponse(req)) return req;
		if (req.participation.conversation.kind !== ConversationKind.GROUP) {
			return badRequest("Only group conversations can be edited");
		}

		const renaming = "name" in body;
		const adding = body.addMembers !== undefined;
		if (!renaming && !adding) return badRequest("Nothing to update");

		if (renaming) {
			const nameCheck = validateGroupName(body.name);
			if (!nameCheck.valid) return badRequest(nameCheck.error!);
		}
		let added = 0;
		if (adding) {
			const membersCheck = validateGroupMemberRefs(body.addMembers);
			if (!membersCheck.valid) return badRequest(membersCheck.error!);
			const result = await addGroupMembers(conversationId, membersCheck.refs!);
			if (!result.ok) return failureResponse(result);
			added = result.value.added;
		}
		if (renaming) await renameGroup(conversationId, (body.name as string | null) ?? null);

		return NextResponse.json({ ok: true, added });
	} catch (error) {
		console.error("PATCH /api/messages/conversations/:id error:", error);
		return serverError();
	}
}
