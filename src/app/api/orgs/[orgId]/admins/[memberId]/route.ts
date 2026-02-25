import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";
import { OrgRole } from "@prisma/client";

type Params = { params: Promise<{ orgId: string; memberId: string }> };

/**
 * DELETE /api/orgs/:orgId/admins/:memberId
 * Remove an admin from the org
 * Protected endpoint - requires OWNER role
 * Cannot remove OWNER members, only ADMIN
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { orgId, memberId } = await params;

		// Check org exists
		const org = await prisma.org.findUnique({ where: { id: orgId } });
		if (!org) {
			return notFound("Organization not found");
		}

		// Check requester has permission (must be OWNER of this org)
		const requesterMembership = await prisma.orgMember.findFirst({
			where: {
				orgId,
				owner: { userId: ctx.userId },
				role: OrgRole.OWNER,
			},
		});

		if (!requesterMembership) {
			return NextResponse.json(
				{ error: "You must be an owner of this organization to remove admins" },
				{ status: 403 }
			);
		}

		// Find the membership to remove
		const memberToRemove = await prisma.orgMember.findUnique({
			where: { id: memberId },
			include: { owner: true },
		});

		if (!memberToRemove || memberToRemove.orgId !== orgId) {
			return notFound("Member not found");
		}

		// Cannot remove an OWNER
		if (memberToRemove.role === OrgRole.OWNER) {
			return NextResponse.json(
				{ error: "Cannot remove an owner from the organization" },
				{ status: 403 }
			);
		}

		// Delete the membership and the org-based owner record
		await prisma.$transaction(async (tx) => {
			// Delete the membership
			await tx.orgMember.delete({
				where: { id: memberId },
			});

			// Delete the org-based owner (this won't affect the user's personal owner)
			await tx.owner.delete({
				where: { id: memberToRemove.ownerId },
			});
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/orgs/:orgId/admins/:memberId error:", error);
		return serverError("Failed to remove admin");
	}
}
