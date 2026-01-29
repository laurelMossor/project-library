import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSessionContext, canSetActiveOwner } from "@/lib/utils/server/session";
import { getPersonalOwner } from "@/lib/utils/server/owner";
import { unauthorized, badRequest, notFound } from "@/lib/utils/errors";

/**
 * GET /api/me/owner
 * Get current active owner info
 * Returns { type: "USER" | "ORG", data: {...} }
 */
export async function GET() {
	const ctx = await getSessionContext();

	if (!ctx) {
		return unauthorized();
	}

	const owner = ctx.activeOwner;

	if (owner.type === "ORG" && owner.org) {
		return NextResponse.json({
			type: "ORG",
			ownerId: owner.id,
			data: {
				id: owner.org.id,
				slug: owner.org.slug,
				name: owner.org.name,
				avatarImageId: owner.org.avatarImageId,
			},
		});
	}

	// Default to USER
	if (owner.user) {
		return NextResponse.json({
			type: "USER",
			ownerId: owner.id,
			data: {
				id: owner.user.id,
				username: owner.user.username,
				displayName: owner.user.displayName,
				firstName: owner.user.firstName,
				lastName: owner.user.lastName,
				avatarImageId: owner.user.avatarImageId,
			},
		});
	}

	return notFound("Owner not found");
}

/**
 * PUT /api/me/owner
 * Switch active owner
 * Body: { ownerId: string | null }
 * If ownerId is null, switch to personal owner
 */
export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const userId = session.user.id;

	try {
		const body = await request.json();
		const { ownerId } = body;

		// If ownerId is null, switch to personal owner
		if (ownerId === null) {
			const personalOwner = await getPersonalOwner(userId);
			if (!personalOwner) {
				return notFound("Personal owner not found");
			}

			return NextResponse.json({
				activeOwnerId: personalOwner.id,
				type: "USER",
				message: "Switched to personal profile",
			});
		}

		// Validate the owner ID
		if (typeof ownerId !== "string") {
			return badRequest("ownerId must be a string or null");
		}

		// Check if user can set this owner
		const canSet = await canSetActiveOwner(userId, ownerId);
		if (!canSet) {
			return badRequest("Cannot switch to this owner");
		}

		return NextResponse.json({
			activeOwnerId: ownerId,
			type: "ORG",
			message: "Switched to organization profile",
		});
	} catch (error) {
		console.error("PUT /api/me/owner error:", error);
		return badRequest("Invalid request");
	}
}
