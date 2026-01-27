import { auth } from "@/lib/auth";
import { canSetActiveOwner } from "@/lib/utils/server/session";
import { success, unauthorized, badRequest, forbidden, serverError } from "@/lib/utils/server/api-response";

/**
 * POST /api/session/active-owner
 * Set the active owner for the current session
 * 
 * Body: { activeOwnerId: string }
 */
export async function POST(request: Request) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return unauthorized();
		}

		const userId = session.user.id;
		const body = await request.json();
		const { activeOwnerId } = body;

		if (!activeOwnerId || typeof activeOwnerId !== "string") {
			return badRequest("activeOwnerId is required");
		}

		// Validate that user can set this owner as active
		const canSet = await canSetActiveOwner(userId, activeOwnerId);
		if (!canSet) {
			return forbidden("You cannot act as this owner");
		}

		// Note: The actual session update needs to happen via NextAuth's update mechanism
		// This endpoint validates the request; the client should call update() on the session
		// to persist the change. We return the validated activeOwnerId.
		
		return success({ activeOwnerId });
	} catch (error) {
		console.error("POST /api/session/active-owner error:", error);
		return serverError();
	}
}
