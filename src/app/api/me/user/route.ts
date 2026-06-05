import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById, updateUserProfile, personalProfileFields } from "@/lib/utils/server/user";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";
import { validateProfileData } from "@/lib/validations";
import { processElementsPayload } from "@/lib/utils/server/profile-element";
import { prisma } from "@/lib/utils/server/prisma";
import type { SavePayload } from "@/lib/types/inline-edit";
import { syncChildPostVisibility } from "@/lib/utils/server/visibility";
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
		const user = await prisma.$transaction(async (tx) => {
			await updateUserProfile(userId, {
				firstName, middleName, lastName,
				displayName, headline, bio,
				interests, location, visibility, avatarImageId, aboutContent,
			});

			// Cascade visibility change to standalone user posts
			if (visibility !== undefined) {
				await syncChildPostVisibility("USER", userId, visibility, tx);
			}

			if (elements) {
				await processElementsPayload({ userId }, elements);
			}

			return tx.user.findUnique({
				where: { id: userId },
				select: personalProfileFields,
			});
		});

		return NextResponse.json(user);
	} catch {
		return badRequest("Failed to update profile");
	}
}
