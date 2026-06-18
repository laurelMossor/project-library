import { NextResponse } from "next/server";
import { getUserByHandle } from "@/lib/utils/server/user";
import { notFound } from "@/lib/utils/errors";
import { getViewerContext, canViewProfile } from "@/lib/utils/server/visibility";

/**
 * GET /api/users/by-handle/[handle]
 *
 * Resolves a user by handle (formerly `/by-username/[username]`).
 *
 * Note: this is User-only — it does NOT consult the `handles` table because
 * callers (e.g. AddConnectionSearch) specifically want to add a USER as a
 * connection, not a Page. For routes that need either, use
 * `findEntityByHandle` from `@/lib/utils/server/handle`.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ handle: string }> }
) {
	const { handle } = await params;

	const [user, viewer] = await Promise.all([getUserByHandle(handle), getViewerContext()]);
	if (!user) {
		return notFound("User not found");
	}

	// Visibility gate: PRIVATE users are 404 for non-followers
	if (!(await canViewProfile("USER", user, viewer))) {
		return notFound("User not found");
	}

	return NextResponse.json(user);
}
