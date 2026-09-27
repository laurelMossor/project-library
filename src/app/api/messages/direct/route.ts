import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/utils/errors";
import { findOrCreateDirectConversation } from "@/lib/utils/server/message";
import { failureResponse, isResponse, readJsonBody, resolveMessagingRequest } from "@/lib/utils/server/message-routes";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";

/**
 * POST /api/messages/direct
 * Resolve the DM between the acting identity and a user/page, creating an empty one if none exists, and
 * return its conversation id. Backs the profile "Message" button and the /messages/u|p/:id entry links.
 * An empty DM stays out of the inbox until it has a message.
 *
 * Body: { targetType: "user" | "page", targetId: string, asPageId?: string }
 */
export async function POST(request: Request) {
	// Resolving can create a (hidden, empty) DM row with anyone, so it's rate-limited like group creation.
	const limited = await enforceRateLimit(request, "dm-resolve", { maxRequests: 120, windowMs: 60 * 60 * 1000 });
	if (limited) return limited;

	try {
		const body = await readJsonBody(request);
		const req = await resolveMessagingRequest(body.asPageId);
		if (isResponse(req)) return req;

		const { targetType, targetId } = body;
		if ((targetType !== "user" && targetType !== "page") || typeof targetId !== "string" || !targetId) {
			return badRequest("targetType ('user' | 'page') and targetId are required");
		}

		const dm = await findOrCreateDirectConversation(req.identity, { type: targetType, id: targetId });
		if (!dm.ok) return failureResponse(dm);
		return NextResponse.json({ conversationId: dm.value.id });
	} catch (error) {
		console.error("POST /api/messages/direct error:", error);
		return serverError();
	}
}
