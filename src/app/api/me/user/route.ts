import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";
import { saveMyProfile } from "@/lib/utils/server/profile-update";
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

	try {
		const result = await saveMyProfile("USER", userId, body);
		if (!result.ok) {
			return badRequest(result.error);
		}
		return NextResponse.json(result.profile);
	} catch {
		return badRequest("Failed to update profile");
	}
}
