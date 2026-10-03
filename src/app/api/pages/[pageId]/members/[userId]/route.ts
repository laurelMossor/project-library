import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import {
	canManagePage,
	getUserPermission,
	grantPermission,
	revokePermission,
	wouldRemoveLastAdmin,
} from "@/lib/utils/server/permission";
import { assignableRoles } from "@/lib/const/roles";
import { prisma } from "@/lib/utils/server/prisma";
import { emitActivity } from "@/lib/utils/server/activity";
import { PermissionRole, ResourceType } from "@prisma/client";

type RouteParams = { params: Promise<{ pageId: string; userId: string }> };

/**
 * PUT /api/pages/[pageId]/members/[userId]
 * Update a member's role
 * Protected endpoint (requires ADMIN permission)
 */
export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { pageId, userId } = await params;
		const isAdmin = await canManagePage(ctx.userId, pageId);
		if (!isAdmin) {
			return unauthorized("You do not have permission to manage this page");
		}

		const data = await request.json();
		const { role } = data;

		if (!role) {
			return badRequest("role is required");
		}

		const page = await prisma.page.findUnique({
			where: { id: pageId },
			select: { membershipPolicy: true },
		});
		if (!page) return badRequest("Page not found");

		// Direct change is for someone who already has a role. New people are invited.
		const existing = await getUserPermission(userId, pageId, ResourceType.PAGE);
		if (!existing) return badRequest("That person is not a member of this page");

		if (!assignableRoles(page.membershipPolicy).includes(role)) {
			return badRequest("Invalid role");
		}

		// Block demoting the last admin (would leave the page with zero admins).
		if (role !== PermissionRole.ADMIN && (await wouldRemoveLastAdmin(pageId, userId))) {
			return badRequest("Cannot remove the last admin from a page");
		}

		const permission = await grantPermission(userId, pageId, ResourceType.PAGE, role);
		if (existing !== role) {
			await emitActivity("role.changed", { type: "PAGE", id: pageId }, { type: "USER", id: userId });
		}

		return NextResponse.json(permission);
	} catch (error) {
		console.error("PUT /api/pages/[pageId]/members/[userId] error:", error);
		return serverError("Failed to update member role");
	}
}

/**
 * DELETE /api/pages/[pageId]/members/[userId]
 * Remove a member from a page
 * Protected endpoint (requires ADMIN permission)
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { pageId, userId } = await params;
		const isAdmin = await canManagePage(ctx.userId, pageId);
		if (!isAdmin) {
			return unauthorized("You do not have permission to manage this page");
		}

		// Prevent removing the last admin (covers self-removal and removing another admin).
		if (await wouldRemoveLastAdmin(pageId, userId)) {
			return badRequest("Cannot remove the last admin from a page");
		}

		await revokePermission(userId, pageId, ResourceType.PAGE);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/pages/[pageId]/members/[userId] error:", error);
		return serverError("Failed to remove member");
	}
}
