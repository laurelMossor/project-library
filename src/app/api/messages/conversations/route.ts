import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/utils/errors";
import { validateGroupMemberRefs, validateGroupName } from "@/lib/validations";
import { createGroup } from "@/lib/utils/server/message";
import { failureResponse, isResponse, readJsonBody, resolveMessagingRequest } from "@/lib/utils/server/message-routes";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { logAction } from "@/lib/utils/server/log";
import { asPageIdOf } from "@/lib/const/messaging";

/**
 * POST /api/messages/conversations
 * Create a GROUP conversation as the acting identity (the creator is always a member).
 *
 * Body: { members: { type: "user" | "page", id: string }[], name?: string | null, asPageId?: string }
 */
export async function POST(request: Request) {
	// Anyone can be added to a group, so creation is rate-limited against spam.
	const limited = await enforceRateLimit(request, "group-create", { maxRequests: 10, windowMs: 60 * 60 * 1000 });
	if (limited) return limited;

	try {
		const body = await readJsonBody(request);
		const req = await resolveMessagingRequest(body.asPageId);
		if (isResponse(req)) return req;

		const nameCheck = validateGroupName(body.name);
		if (!nameCheck.valid) return badRequest(nameCheck.error!);
		const membersCheck = validateGroupMemberRefs(body.members);
		if (!membersCheck.valid) return badRequest(membersCheck.error!);

		const result = await createGroup(req.identity, membersCheck.refs!, body.name as string | null | undefined);
		if (!result.ok) return failureResponse(result);

		logAction("message.group_created", req.userId, {
			conversationId: result.value.id,
			memberCount: membersCheck.refs!.length,
			asPageId: asPageIdOf(req.identity),
		});
		return NextResponse.json({ conversationId: result.value.id }, { status: 201 });
	} catch (error) {
		console.error("POST /api/messages/conversations error:", error);
		return serverError();
	}
}
