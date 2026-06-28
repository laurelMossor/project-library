import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";
import { canManageEntity } from "@/lib/utils/server/permission";
import { listPageRequests } from "@/lib/utils/server/requests";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/requests
 * Pending access requests targeting a page. ADMIN/EDITOR only.
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId } = await params;
		if (!(await canManageEntity(ctx.userId, { page: { id: pageId } }))) {
			return unauthorized("You do not have permission to view this page's requests");
		}

		const requests = await listPageRequests(pageId);
		return NextResponse.json({ requests, count: requests.length });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/requests error:", error);
		return serverError("Failed to fetch requests");
	}
}
