import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canSetActivePage } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";

/**
 * PUT /api/session/active-page
 * Set the active page ID in session
 * Protected endpoint
 *
 * Body: { activePageId: string }
 */
export async function PUT(request: Request) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return unauthorized();
		}

		const userId = session.user.id;
		const body = await request.json();
		const { activePageId } = body;

		if (!activePageId || typeof activePageId !== "string") {
			return badRequest("activePageId is required");
		}

		// Validate that user can set this page as active
		const canSet = await canSetActivePage(userId, activePageId);
		if (!canSet) {
			return NextResponse.json(
				{ error: "You cannot act as this page" },
				{ status: 403 }
			);
		}

		// The actual session update happens via NextAuth's update mechanism.
		// This endpoint validates the request; the client should call update() on the session
		// to persist the change.
		return NextResponse.json({ activePageId });
	} catch (error) {
		console.error("PUT /api/session/active-page error:", error);
		return serverError();
	}
}

/**
 * DELETE /api/session/active-page
 * Clear active page (go back to personal identity)
 * Protected endpoint
 */
export async function DELETE() {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return unauthorized();
		}

		// The actual session update happens via NextAuth's update mechanism.
		// This endpoint signals intent; the client should call update() on the session
		// to clear the activePageId.
		return NextResponse.json({ activePageId: null, message: "Switched to personal identity" });
	} catch (error) {
		console.error("DELETE /api/session/active-page error:", error);
		return serverError();
	}
}
