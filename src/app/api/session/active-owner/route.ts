import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canSetActiveOwner } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";

/**
 * POST /api/session/active-owner
 * Set the active owner for the current session
 * Protected endpoint
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
			return NextResponse.json(
				{ error: "You cannot act as this owner" },
				{ status: 403 }
			);
		}

		// Note: The actual session update needs to happen via NextAuth's update mechanism
		// This endpoint validates the request; the client should call update() on the session
		// to persist the change. We return the validated activeOwnerId.

		return NextResponse.json({ activeOwnerId });
	} catch (error) {
		console.error("POST /api/session/active-owner error:", error);
		return serverError();
	}
}
