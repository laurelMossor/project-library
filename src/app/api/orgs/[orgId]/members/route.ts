import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { OrgRole, OwnerType, OwnerStatus } from "@prisma/client";

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /api/orgs/:orgId/members
 * List org members with owner + role
 * Public endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { orgId } = await params;

		const org = await prisma.org.findUnique({ where: { id: orgId } });
		if (!org) {
			return notFound("Organization not found");
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

		const membersList = members.map((m) => ({
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
		}));

		return NextResponse.json(membersList);
	} catch (error) {
		console.error("GET /api/orgs/:orgId/members error:", error);
		return serverError("Failed to fetch members");
	}
}

/**
 * POST /api/orgs/:orgId/members
 * Add a member to the org
 * Protected endpoint - requires OWNER or ADMIN role
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
			return notFound("Organization not found");
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
			return NextResponse.json(
				{ error: "You must be an owner or admin of this organization" },
				{ status: 403 }
			);
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
				return badRequest("User is already a member of this organization");
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

		return NextResponse.json(
			{
				id: result.membership.id,
				ownerId: result.orgOwner.id,
				role: result.membership.role,
				createdAt: result.membership.createdAt,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/orgs/:orgId/members error:", error);
		return serverError("Failed to add member");
	}
}
