import { serverError } from "@/lib/utils/errors";
import {
	handleSend,
	isResponse,
	limitMessageSends,
	readJsonBody,
	resolveParticipantRequest,
} from "@/lib/utils/server/message-routes";

type Params = { params: Promise<{ conversationId: string }> };

/**
 * POST /api/messages/conversations/:conversationId/messages
 * Send into a conversation (DM or group) as the acting identity. Non-participants get 404.
 *
 * Body: { content: string, asPageId?: string }
 */
export async function POST(request: Request, { params }: Params) {
	const limited = await limitMessageSends(request);
	if (limited) return limited;

	try {
		const { conversationId } = await params;
		const body = await readJsonBody(request);
		const req = await resolveParticipantRequest(conversationId, body.asPageId);
		if (isResponse(req)) return req;
		return handleSend(req, conversationId, body, { kind: req.participation.conversation.kind });
	} catch (error) {
		console.error("POST /api/messages/conversations/:id/messages error:", error);
		return serverError();
	}
}
