import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/utils/errors";
import { getSoleAdminPages } from "@/lib/utils/server/permission";

/**
 * GET /api/me/user/delete-preview
 * The pages that go away with this account: ones where the user is the only admin.
 */
export async function GET() {
	const session = await auth();
	if (!session?.user?.id) return unauthorized();

	const pages = await getSoleAdminPages(session.user.id);
	return NextResponse.json({ pages });
}
