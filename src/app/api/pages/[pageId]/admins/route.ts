import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import {
	canManagePage,
	getResourcePermissions,
	grantPermission,
} from "@/lib/utils/server/permission";
import { ResourceType, PermissionRole } from "@prisma/client";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]/admins
 * List admins (ADMIN-role permissions) for a page
 * Public endpoint — used by ManageConnections permission check
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const permissions = await getResourcePermissions(pageId, ResourceType.PAGE);
		const admins = permissions.filter((p) => p.role === PermissionRole.ADMIN);

		return NextResponse.json({ admins });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/admins error:", error);
		return serverError("Failed to fetch admins");
	}
}

/**
 * POST /api/pages/[pageId]/admins
 * Add a user as an admin of a page
 * Protected endpoint (requires ADMIN permission)
 */
export async function POST(request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { pageId } = await params;
		const isAdmin = await canManagePage(ctx.userId, pageId);
		if (!isAdmin) {
			return unauthorized("You do not have permission to manage admins for this page");
		}

		const data = await request.json();
		const { userId } = data;

		if (!userId) {
			return badRequest("userId is required");
		}

		const permission = await grantPermission(userId, pageId, ResourceType.PAGE, PermissionRole.ADMIN);

		return NextResponse.json(permission, { status: 201 });
	} catch (error) {
		console.error("POST /api/pages/[pageId]/admins error:", error);
		return serverError("Failed to add admin");
	}
}
