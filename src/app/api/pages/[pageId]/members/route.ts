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
 * GET /api/pages/[pageId]/members
 * List members (permissions) for a page
 * Public endpoint
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const permissions = await getResourcePermissions(pageId, ResourceType.PAGE);

		return NextResponse.json(permissions);
	} catch (error) {
		console.error("GET /api/pages/[pageId]/members error:", error);
		return serverError("Failed to fetch members");
	}
}

/**
 * POST /api/pages/[pageId]/members
 * Add a member to a page
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
			return unauthorized("You do not have permission to manage this page");
		}

		const data = await request.json();
		const { userId, role } = data;

		if (!userId || !role) {
			return badRequest("userId and role are required");
		}

		if (!Object.values(PermissionRole).includes(role)) {
			return badRequest("Invalid role");
		}

		const permission = await grantPermission(userId, pageId, ResourceType.PAGE, role);

		return NextResponse.json(permission, { status: 201 });
	} catch (error) {
		console.error("POST /api/pages/[pageId]/members error:", error);
		return serverError("Failed to add member");
	}
}
