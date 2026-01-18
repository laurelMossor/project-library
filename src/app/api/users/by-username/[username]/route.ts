import { NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/utils/server/user";
import { notFound } from "@/lib/utils/errors";

/**
 * GET /api/users/by-username/[username]
 * Get user by username (for admin management, etc.)
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ username: string }> }
) {
	const { username } = await params;

	const user = await getUserByUsername(username);
	if (!user) {
		return notFound("User not found");
	}

	return NextResponse.json(user);
}
