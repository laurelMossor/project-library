import { NextResponse } from "next/server";
import { getUserByHandle } from "@/lib/utils/server/user";
import { notFound } from "@/lib/utils/errors";

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

	const user = await getUserByHandle(handle);
	if (!user) {
		return notFound("User not found");
	}

	return NextResponse.json(user);
}
