import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";
import { validateProfileData } from "@/lib/validations";
import { updateProfileWithCascade } from "@/lib/utils/server/profile-update";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { Visibility } from "@prisma/client";

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
 * Update current user's profile. Accepts a structured SavePayload with scalar
 * fields and optional element operations.
 */
export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const userId = session.user.id;
	const body = (await request.json()) as SavePayload;
	const { fields = {}, elements } = body;

	const {
		firstName, middleName, lastName,
		displayName, headline, bio,
		interests, location, visibility, avatarImageId, aboutContent,
	} = fields as {
		firstName?: string;
		middleName?: string;
		lastName?: string;
		displayName?: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		visibility?: Visibility;
		avatarImageId?: string | null;
		aboutContent?: string | null;
	};

	// Validate profile data
	const validation = validateProfileData({ displayName, headline, bio, interests, location, visibility });
	if (!validation.valid) {
		return badRequest(validation.error || "Invalid profile data");
	}

	for (const [name, value] of Object.entries({ firstName, middleName, lastName })) {
		if (value !== undefined && value.length > 100) {
			return badRequest(`${name} must be 100 characters or fewer`);
		}
	}

	if (aboutContent !== undefined && aboutContent !== null && aboutContent.length > 50000) {
		return badRequest("aboutContent must be 50,000 characters or fewer");
	}

	try {
		const user = await updateProfileWithCascade("USER", userId, {
			firstName, middleName, lastName,
			displayName, headline, bio,
			interests, location, visibility, avatarImageId, aboutContent,
		}, elements);

		return NextResponse.json(user);
	} catch {
		return badRequest("Failed to update profile");
	}
}
