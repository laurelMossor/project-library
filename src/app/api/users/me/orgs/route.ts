import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgsForUser } from "@/lib/utils/server/org";
import { unauthorized } from "@/lib/utils/errors";

/**
 * GET /api/users/me/orgs
 * Get all organizations the current user belongs to
 */
export async function GET() {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const orgs = await getOrgsForUser(session.user.id);

	return NextResponse.json(orgs);
}
