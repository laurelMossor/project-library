import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById, updateUserProfile } from "@/lib/utils/server/user";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";
import { validateProfileData } from "@/lib/validations";

/**
 * GET /api/me/user
 * Get current user's profile
 */
export async function GET() {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const user = await getUserById(session.user.id);

	if (!user) {
		return notFound("User not found");
	}

	return NextResponse.json(user);
}

/**
 * PUT /api/me/user
 * Update current user's profile
 * Note: DELETE operation is intentionally omitted - account deletion is not part of MVP
 */
export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const data = await request.json();
	const { firstName, middleName, lastName, headline, bio, interests, location, avatarImageId } = data;

	// Validate profile data
	const validation = validateProfileData({ firstName, middleName, lastName, headline, bio, interests, location });
	if (!validation.valid) {
		return badRequest(validation.error || "Invalid profile data");
	}

	try {
		const user = await updateUserProfile(session.user.id, {
			firstName,
			middleName,
			lastName,
			headline,
			bio,
			interests,
			location,
			avatarImageId,
		});

		return NextResponse.json(user);
	} catch (error) {
		return badRequest("Failed to update profile");
	}
}
