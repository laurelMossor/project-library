import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/me/pages
 * Get all pages the current user has permissions on
 * Protected endpoint
 */
export async function GET() {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return unauthorized();
		}

		const pages = await getPagesForUser(session.user.id);

		return NextResponse.json(pages);
	} catch (error) {
		console.error("GET /api/me/pages error:", error);
		return serverError();
	}
}
