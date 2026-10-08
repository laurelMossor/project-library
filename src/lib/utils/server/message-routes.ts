// ⚠️ SERVER-ONLY: Shared prelude for the messaging routes.
//
// Every messaging route does the same three steps — session → acting identity (a client `asPageId` is
// verified, never trusted; VISIBILITY_RULES §1.9) → participation in the addressed conversation (404 for
// non-participants, never 403). They live here once so no route can skip a step.
import { NextResponse } from "next/server";
import { getSessionContext } from "./session";
import { getParticipation, resolveMessagingIdentity, sendConversationMessage, type MessagingIdentity } from "./message";
import { enforceRateLimit } from "./rate-limit";
import { logAction } from "./log";
import { unauthorized, badRequest, notFound } from "@/lib/utils/errors";
import { validateMessageContent } from "@/lib/validations";
import { asPageIdOf } from "@/lib/const/messaging";

export type MessagingRequest = { userId: string; identity: MessagingIdentity };

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;

/** Parse a JSON body; `{}` when absent or malformed (callers validate the fields they need). */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await request.json();
		return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

/** `asPageId` from the query string (GET) — the body variant is read by the caller. */
export function asPageIdFromQuery(request: Request): string | null {
	return new URL(request.url).searchParams.get("asPageId") || null;
}

/** Session + acting identity, or the 401/400 response to return. */
export async function resolveMessagingRequest(asPageId: unknown): Promise<MessagingRequest | NextResponse> {
	const ctx = await getSessionContext();
	if (!ctx) return unauthorized();
	const identity = await resolveMessagingIdentity(ctx.userId, typeof asPageId === "string" ? asPageId : null);
	if (!identity) return badRequest("You don't have permission to act as this page");
	return { userId: ctx.userId, identity };
}

/** As `resolveMessagingRequest`, plus the identity must participate in the conversation (else 404). */
export async function resolveParticipantRequest(conversationId: string, asPageId: unknown) {
	const req = await resolveMessagingRequest(asPageId);
	if (isResponse(req)) return req;
	const participation = await getParticipation(conversationId, req.identity);
	if (!participation) return notFound("Conversation not found");
	return { ...req, participation };
}

/** Map a server-layer failure to its response. */
export function failureResponse(result: { status: 400 | 404; error: string }): NextResponse {
	return result.status === 404 ? notFound(result.error) : badRequest(result.error);
}

/** Shared limit for every route that sends a message (DM by recipient, or into a conversation). */
export function limitMessageSends(request: Request) {
	return enforceRateLimit(request, "message-send", { maxRequests: 30, windowMs: 60 * 1000 });
}

/**
 * Validate `body.content`, send it into `conversationId` as the acting identity, log, and return the
 * 201. The one send path behind POST /api/messages and POST /api/messages/conversations/:id/messages —
 * callers establish the conversation and the identity's right to post in it first.
 */
export async function handleSend(
	req: MessagingRequest,
	conversationId: string,
	body: Record<string, unknown>,
	logExtra: Record<string, unknown> = {},
): Promise<NextResponse> {
	const check = validateMessageContent(body.content as string);
	if (!check.valid) return badRequest(check.error || "Invalid message content");

	const message = await sendConversationMessage({
		conversationId,
		identity: req.identity,
		senderUserId: req.userId,
		content: (body.content as string).trim(),
	});
	logAction("message.sent", req.userId, { conversationId, asPageId: asPageIdOf(req.identity), ...logExtra });
	return NextResponse.json(
		{ id: message.id, conversationId, content: message.content, createdAt: message.createdAt },
		{ status: 201 },
	);
}
