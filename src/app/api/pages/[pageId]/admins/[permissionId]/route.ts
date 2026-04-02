import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { canManagePage } from "@/lib/utils/server/permission";
import { ResourceType, PermissionRole } from "@prisma/client";

type RouteParams = { params: Promise<{ pageId: string; permissionId: string }> };

/**
 * DELETE /api/pages/[pageId]/admins/[permissionId]
 * Remove an admin from a page by permission record id
 * Protected endpoint (requires ADMIN permission)
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { pageId, permissionId } = await params;
		const isAdmin = await canManagePage(ctx.userId, pageId);
		if (!isAdmin) {
			return unauthorized("You do not have permission to manage admins for this page");
		}

		const permission = await prisma.permission.findUnique({
			where: { id: permissionId },
		});

		if (!permission || permission.resourceId !== pageId || permission.role !== PermissionRole.ADMIN) {
			return notFound("Admin record not found");
		}

		// Prevent removing the last admin
		const adminCount = await prisma.permission.count({
			where: {
				resourceId: pageId,
				resourceType: ResourceType.PAGE,
				role: PermissionRole.ADMIN,
			},
		});

		if (adminCount <= 1) {
			return badRequest("Cannot remove the last admin from a page");
		}

		await prisma.permission.delete({ where: { id: permissionId } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/pages/[pageId]/admins/[permissionId] error:", error);
		return serverError("Failed to remove admin");
	}
}
