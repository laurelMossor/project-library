import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgById, updateOrgProfile, getUserOrgRole } from "@/lib/utils/server/org";
import { unauthorized, badRequest } from "@/lib/utils/errors";
import { validateOrgUpdateData } from "@/lib/validations";

/**
 * GET /api/me/org
 * Get the current active org's profile (based on activeOrgId in session)
 */
export async function GET() {
	const session = await auth();

	if (!session?.user?.id || !session?.user?.activeOrgId) {
		return unauthorized();
	}

	const orgId = session.user.activeOrgId;

	// Verify user has permission to act as this org
	const role = await getUserOrgRole(session.user.id, orgId);
	if (!role || role === "FOLLOWER") {
		return unauthorized();
	}

	const org = await getOrgById(orgId);

	if (!org) {
		return badRequest("Organization not found");
	}

	return NextResponse.json(org);
}

/**
 * PUT /api/me/org
 * Update the current active org's profile (based on activeOrgId in session)
 */
export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id || !session?.user?.activeOrgId) {
		return unauthorized();
	}

	const orgId = session.user.activeOrgId;

	// Verify user has permission to act as this org
	const role = await getUserOrgRole(session.user.id, orgId);
	if (!role || role === "FOLLOWER") {
		return unauthorized();
	}

	const data = await request.json();
	const { headline, bio, interests, location, avatarImageId } = data;

	// Validate org update data
	const validation = validateOrgUpdateData({
		headline,
		bio,
		interests,
		location,
		avatarImageId,
	});
	if (!validation.valid) {
		return badRequest(validation.error || "Invalid org data");
	}

	try {
		const org = await updateOrgProfile(orgId, {
			headline,
			bio,
			interests,
			location,
			avatarImageId,
		});

		return NextResponse.json(org);
	} catch (error) {
		return badRequest("Failed to update org profile");
	}
}
