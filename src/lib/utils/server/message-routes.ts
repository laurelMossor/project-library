// ⚠️ SERVER-ONLY: Shared prelude for the messaging read routes (inbox, thread, suggestions).
//
// Session → acting identity (a client `asPageId` is verified, never trusted; VISIBILITY_RULES §1.9).
// Messaging writes are Server Actions; their guarded steps live in message-commands.ts.
import { NextResponse } from "next/server";
import { getSessionContext } from "./session";
import { resolveMessagingIdentity, type MessagingIdentity } from "./message";
import { unauthorized, badRequest } from "@/lib/utils/errors";

export type MessagingRequest = { userId: string; identity: MessagingIdentity };

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;

/** `asPageId` from the query string. */
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
