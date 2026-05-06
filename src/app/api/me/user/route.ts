import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById, updateUserProfile, personalProfileFields } from "@/lib/utils/server/user";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";
import { validateProfileData } from "@/lib/validations";
import { processElementsPayload } from "@/lib/utils/server/profile-element";
import { prisma } from "@/lib/utils/server/prisma";
import type { SavePayload } from "@/lib/types/inline-edit";

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
		displayName, headline, bio,
		interests, location, isPublic, avatarImageId, aboutContent,
	} = fields as {
		displayName?: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		isPublic?: boolean;
		avatarImageId?: string | null;
		aboutContent?: string | null;
	};

	// Validate profile data
	const validation = validateProfileData({ displayName, headline, bio, interests, location, isPublic });
	if (!validation.valid) {
		return badRequest(validation.error || "Invalid profile data");
	}

	if (aboutContent !== undefined && aboutContent !== null && aboutContent.length > 50000) {
		return badRequest("aboutContent must be 50,000 characters or fewer");
	}

	try {
		const user = await prisma.$transaction(async () => {
			await updateUserProfile(userId, {
				displayName, headline, bio,
				interests, location, isPublic, avatarImageId, aboutContent,
			});

			if (elements) {
				await processElementsPayload({ userId }, elements);
			}

			return prisma.user.findUnique({
				where: { id: userId },
				select: personalProfileFields,
			});
		});

		return NextResponse.json(user);
	} catch {
		return badRequest("Failed to update profile");
	}
}
