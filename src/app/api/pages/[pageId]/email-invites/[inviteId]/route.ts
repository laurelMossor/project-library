import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";
import { canManagePage } from "@/lib/utils/server/permission";
import { cancelPageEmailInvite } from "@/lib/utils/server/requests";

type RouteParams = { params: Promise<{ pageId: string; inviteId: string }> };

/**
 * DELETE /api/pages/[pageId]/email-invites/[inviteId]
 * Cancel a pending email invite, so nothing is waiting when that address signs up. Page ADMIN only.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId, inviteId } = await params;
		if (!(await canManagePage(ctx.userId, pageId))) {
			return unauthorized("You do not have permission to manage this page");
		}

		if (!(await cancelPageEmailInvite(pageId, inviteId))) return notFound("Invite not found");
		return NextResponse.json({ status: "cancelled" });
	} catch (error) {
		console.error("DELETE /api/pages/[pageId]/email-invites/[inviteId] error:", error);
		return serverError("Failed to cancel invite");
	}
}
