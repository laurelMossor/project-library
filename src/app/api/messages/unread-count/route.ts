import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { getManagedPageIds } from "@/lib/utils/server/permission";
import { countUnreadForIdentity } from "@/lib/utils/server/message";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/messages/unread-count
 * Unread message counts split by identity:
 *   { personal: number, pages: { [pageId]: number } }
 * Each identity counts against its own read marker, so one group member (or one of a page's
 * managers) reading never clears another identity's count. Protected endpoint.
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const pageIds = await getManagedPageIds(ctx.userId);
		const [personal, pageCounts] = await Promise.all([
			countUnreadForIdentity({ type: "user", id: ctx.userId }),
			Promise.all(pageIds.map((id) => countUnreadForIdentity({ type: "page", id }))),
		]);

		const pages: Record<string, number> = {};
		pageIds.forEach((id, i) => { pages[id] = pageCounts[i]; });
		return NextResponse.json({ personal, pages });
	} catch (error) {
		console.error("GET /api/messages/unread-count error:", error);
		return serverError();
	}
}
