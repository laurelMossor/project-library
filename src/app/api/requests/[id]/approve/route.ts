import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";
import { approveRequest } from "@/lib/utils/server/requests";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/requests/[id]/approve
 * Approve a pending request — materializes the edge and deletes the request.
 * Authorization (target's manager / the user themselves) is enforced in approveRequest.
 */
export async function POST(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { id } = await params;
		const result = await approveRequest(ctx.userId, id);
		if (!result.ok) {
			if (result.reason === "not_found") return notFound("Request not found");
			return unauthorized("You cannot act on this request");
		}
		return NextResponse.json(result);
	} catch (error) {
		console.error("POST /api/requests/[id]/approve error:", error);
		return serverError("Failed to approve request");
	}
}
