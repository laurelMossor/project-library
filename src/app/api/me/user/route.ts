import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { unauthorized, notFound } from "@/lib/utils/errors";

export const maxDuration = 60;

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
