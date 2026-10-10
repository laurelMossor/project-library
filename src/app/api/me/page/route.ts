import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { getPageById } from "@/lib/utils/server/page";
import { getActingRole } from "@/lib/utils/server/permission";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";

/**
 * GET /api/me/page
 * Get the active page profile (if activePageId set in session)
 * Protected endpoint
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		if (!ctx.activePageId) {
			return notFound("No active page set. Currently acting as personal identity.");
		}

		// Re-verify the caller may act as this page — activePageId comes from the JWT, which
		// can be set client-side via updateSession without going through the validated route.
		// One permission read. A member, or a missing row, is the same 404 as a missing page.
		const role = await getActingRole(ctx.userId, ctx.activePageId);
		if (!role) {
			return notFound("Active page not found");
		}

		const page = await getPageById(ctx.activePageId);
		if (!page) {
			return notFound("Active page not found");
		}

		return NextResponse.json({ ...page, role });
	} catch (error) {
		console.error("GET /api/me/page error:", error);
		return serverError();
	}
}
