import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { getOrCreateOrgOwner } from "@/lib/utils/server/owner";
import { success, unauthorized, badRequest, forbidden, notFound, serverError } from "@/lib/utils/server/api-response";
import { OrgRole, OwnerType, OwnerStatus } from "@prisma/client";

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /api/orgs/:orgId/members
 * List org members with owner + role
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { orgId } = await params;

		const org = await prisma.org.findUnique({ where: { id: orgId } });
		if (!org) {
			return notFound("Org not found");
		}

		const members = await prisma.orgMember.findMany({
			where: { orgId },
			include: {
				owner: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								displayName: true,
								firstName: true,
								lastName: true,
								avatarImageId: true,
							},
						},
					},
				},
			},
			orderBy: [{ role: "asc" }, { createdAt: "asc" }],
		});

		return success({
			members: members.map((m) => ({
				id: m.id,
				ownerId: m.ownerId,
				role: m.role,
				createdAt: m.createdAt,
				user: m.owner.user
					? {
							id: m.owner.user.id,
							username: m.owner.user.username,
							displayName: m.owner.user.displayName,
							firstName: m.owner.user.firstName,
							lastName: m.owner.user.lastName,
							avatarImageId: m.owner.user.avatarImageId,
					  }
					: null,
			})),
		});
	} catch (error) {
		console.error("GET /api/orgs/:orgId/members error:", error);
		return serverError();
	}
}

/**
 * POST /api/orgs/:orgId/members
 * Add a member to the org
 * 
 * Body: { userId: string, role?: OrgRole }
 */
export async function POST(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { orgId } = await params;
		const body = await request.json();
		const { userId, role = OrgRole.MEMBER } = body;

		if (!userId || typeof userId !== "string") {
			return badRequest("userId is required");
		}

		// Check org exists
		const org = await prisma.org.findUnique({ where: { id: orgId } });
		if (!org) {
			return notFound("Org not found");
		}

		// Check requester has permission (must be OWNER or ADMIN of this org)
		const requesterMembership = await prisma.orgMember.findFirst({
			where: {
				orgId,
				owner: { userId: ctx.userId },
				role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
			},
		});

		if (!requesterMembership) {
			return forbidden("You must be an owner or admin of this org");
		}

		// Check target user exists
		const targetUser = await prisma.user.findUnique({ where: { id: userId } });
		if (!targetUser) {
			return notFound("User not found");
		}

		// Check if user already has a membership via an org-based owner
		const existingOwner = await prisma.owner.findFirst({
			where: { userId, orgId },
		});

		if (existingOwner) {
			const existingMembership = await prisma.orgMember.findUnique({
				where: { ownerId: existingOwner.id },
			});
			if (existingMembership) {
				return badRequest("User is already a member of this org");
			}
		}

		// Create org-based owner for the user and membership
		const result = await prisma.$transaction(async (tx) => {
			// Create or get org-based owner
			let orgOwner = existingOwner;
			if (!orgOwner) {
				orgOwner = await tx.owner.create({
					data: {
						userId,
						orgId,
						type: OwnerType.ORG,
						status: OwnerStatus.ACTIVE,
					},
				});
			}

			// Create membership
			const membership = await tx.orgMember.create({
				data: {
					orgId,
					ownerId: orgOwner.id,
					role: role as OrgRole,
				},
			});

			return { orgOwner, membership };
		});

		return success(
			{
				member: {
					id: result.membership.id,
					ownerId: result.orgOwner.id,
					role: result.membership.role,
					createdAt: result.membership.createdAt,
				},
			},
			201
		);
	} catch (error) {
		console.error("POST /api/orgs/:orgId/members error:", error);
		return serverError();
	}
}
