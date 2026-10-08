import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";
import { listMyInvites } from "@/lib/utils/server/requests";

/**
 * GET /api/me/invites
 * Role invitations waiting on the current user (the Membership tab's pending group).
 */
export async function GET() {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const invites = await listMyInvites(ctx.userId);
		return NextResponse.json({
			invites: invites.map((inv) => ({
				id: inv.id,
				role: inv.role,
				note: inv.note,
				page: inv.requesterPage,
				createdAt: inv.createdAt,
			})),
		});
	} catch (error) {
		console.error("GET /api/me/invites error:", error);
		return serverError("Failed to fetch invites");
	}
}
