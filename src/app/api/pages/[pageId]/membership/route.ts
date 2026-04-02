import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, serverError, badRequest } from "@/lib/utils/errors";
import {
	getUserPermission,
	grantPermission,
	revokePermission,
} from "@/lib/utils/server/permission";
import { ResourceType, PermissionRole } from "@prisma/client";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/membership
 * Returns the current user's role on the page, or null if unauthenticated / not a member.
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const ctx = await getSessionContext();
		if (!ctx) {
			return NextResponse.json({ role: null });
		}

		const role = await getUserPermission(ctx.userId, pageId, ResourceType.PAGE);
		return NextResponse.json({ role });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/membership error:", error);
		return serverError("Failed to fetch membership");
	}
}

/**
 * POST /api/pages/[pageId]/membership
 * Self-service join: grants the current user MEMBER role.
 * Returns 409 if they already have ADMIN or EDITOR (no downgrade).
 */
export async function POST(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId } = await params;
		const existing = await getUserPermission(ctx.userId, pageId, ResourceType.PAGE);

		if (existing && existing !== PermissionRole.MEMBER) {
			return badRequest("You already have a role on this page");
		}

		if (existing === PermissionRole.MEMBER) {
			return NextResponse.json({ role: PermissionRole.MEMBER });
		}

		await grantPermission(ctx.userId, pageId, ResourceType.PAGE, PermissionRole.MEMBER);
		return NextResponse.json({ role: PermissionRole.MEMBER }, { status: 201 });
	} catch (error) {
		console.error("POST /api/pages/[pageId]/membership error:", error);
		return serverError("Failed to join page");
	}
}

/**
 * DELETE /api/pages/[pageId]/membership
 * Self-service leave: removes MEMBER role.
 * Refuses if the user is ADMIN or EDITOR (use page settings to manage those roles).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) return unauthorized();

		const { pageId } = await params;
		const existing = await getUserPermission(ctx.userId, pageId, ResourceType.PAGE);

		if (!existing) {
			return NextResponse.json({ success: true });
		}

		if (existing !== PermissionRole.MEMBER) {
			return badRequest("Admins and editors must manage their role from page settings");
		}

		await revokePermission(ctx.userId, pageId, ResourceType.PAGE);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/pages/[pageId]/membership error:", error);
		return serverError("Failed to leave page");
	}
}
