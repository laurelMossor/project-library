import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { success, unauthorized, badRequest, forbidden, notFound, serverError } from "@/lib/utils/server/api-response";
import { OrgRole } from "@prisma/client";

type Params = { params: Promise<{ orgId: string; ownerId: string }> };

/**
 * PATCH /api/orgs/:orgId/members/:ownerId
 * Update a member's role
 * 
 * Body: { role: OrgRole }
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { orgId, ownerId } = await params;
		const body = await request.json();
		const { role } = body;

		if (!role || !Object.values(OrgRole).includes(role)) {
			return badRequest("Valid role is required (OWNER, ADMIN, or MEMBER)");
		}

		// Check org exists
		const org = await prisma.org.findUnique({ where: { id: orgId } });
		if (!org) {
			return notFound("Org not found");
		}

		// Check requester has permission (must be OWNER of this org)
		// Only OWNER can change roles
		const requesterMembership = await prisma.orgMember.findFirst({
			where: {
				orgId,
				owner: { userId: ctx.userId },
				role: OrgRole.OWNER,
			},
		});

		if (!requesterMembership) {
			return forbidden("You must be an owner of this org to change roles");
		}

		// Find the target membership
		const targetMembership = await prisma.orgMember.findUnique({
			where: { ownerId },
		});

		if (!targetMembership || targetMembership.orgId !== orgId) {
			return notFound("Member not found in this org");
		}

		// Prevent demoting the last OWNER
		if (targetMembership.role === OrgRole.OWNER && role !== OrgRole.OWNER) {
			const ownerCount = await prisma.orgMember.count({
				where: { orgId, role: OrgRole.OWNER },
			});
			if (ownerCount <= 1) {
				return badRequest("Cannot demote the last owner of the org");
			}
		}

		// Update the role
		const updated = await prisma.orgMember.update({
			where: { ownerId },
			data: { role },
		});

		return success({
			member: {
				id: updated.id,
				ownerId: updated.ownerId,
				role: updated.role,
			},
		});
	} catch (error) {
		console.error("PATCH /api/orgs/:orgId/members/:ownerId error:", error);
		return serverError();
	}
}
