import { badRequest, serverError } from "@/lib/utils/errors";
import { validateMessageContent } from "@/lib/validations";
import { findOrCreateDirectConversation, type MessagingIdentity } from "@/lib/utils/server/message";
import {
	failureResponse,
	handleSend,
	isResponse,
	limitMessageSends,
	readJsonBody,
	resolveMessagingRequest,
} from "@/lib/utils/server/message-routes";

/**
 * POST /api/messages
 * Send a direct message to a user or page by id — resolves (creating if needed) the DM between the
 * acting identity and the recipient, then sends into it. Group sends go to
 * /api/messages/conversations/:id/messages instead.
 *
 * Body: { recipientUserId?: string, recipientPageId?: string, content: string, asPageId?: string }
 * Exactly one of recipientUserId or recipientPageId must be provided.
 */
export async function POST(request: Request) {
	const limited = await limitMessageSends(request);
	if (limited) return limited;

	try {
		const body = await readJsonBody(request);
		const req = await resolveMessagingRequest(body.asPageId);
		if (isResponse(req)) return req;

		const { recipientUserId, recipientPageId } = body;
		// Validate before resolving so a bad body never creates an empty DM.
		const contentCheck = validateMessageContent(body.content as string);
		if (!contentCheck.valid) return badRequest(contentCheck.error || "Invalid message content");
		if ((!recipientUserId && !recipientPageId) || (recipientUserId && recipientPageId)) {
			return badRequest("Exactly one of recipientUserId or recipientPageId must be provided");
		}
		const target: MessagingIdentity = recipientUserId
			? { type: "user", id: String(recipientUserId) }
			: { type: "page", id: String(recipientPageId) };

		const dm = await findOrCreateDirectConversation(req.identity, target);
		if (!dm.ok) return failureResponse(dm);
		return handleSend(req, dm.value.id, body, { isNewConversation: dm.value.created });
	} catch (error) {
		console.error("POST /api/messages error:", error);
		return serverError();
	}
}
