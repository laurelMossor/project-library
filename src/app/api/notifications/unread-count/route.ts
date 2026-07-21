import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { getUnreadCounts } from "@/lib/utils/server/notification";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/notifications/unread-count
 * Per-identity unread counts for the bell + profile-switcher dots:
 *   { personal: number, pages: { [pageId]: number } }
 * Scoped to the session user. The cheap poll target.
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();
		return NextResponse.json(await getUnreadCounts(ctx.userId));
	} catch (error) {
		console.error("GET /api/notifications/unread-count error:", error);
		return serverError();
	}
}
