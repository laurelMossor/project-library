import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";
import { denyRequest } from "@/lib/utils/server/requests";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/requests/[id]/deny
 * Deny a pending request — deletes it (re-requesting later is allowed).
 * Authorization is enforced in denyRequest.
 */
export async function POST(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { id } = await params;
		const result = await denyRequest(ctx.userId, id);
		if (!result.ok) {
			if (result.reason === "not_found") return notFound("Request not found");
			return unauthorized("You cannot act on this request");
		}
		return NextResponse.json(result);
	} catch (error) {
		console.error("POST /api/requests/[id]/deny error:", error);
		return serverError("Failed to deny request");
	}
}
