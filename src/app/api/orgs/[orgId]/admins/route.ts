import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { OrgRole, OwnerType, OwnerStatus } from "@prisma/client";

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /api/orgs/:orgId/admins
 * List org admins (OWNER and ADMIN roles)
 * Public endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { orgId } = await params;

		const org = await prisma.org.findUnique({ where: { id: orgId } });
		if (!org) {
			return notFound("Organization not found");
		}

		const admins = await prisma.orgMember.findMany({
			where: {
				orgId,
				role: { in: [OrgRole.OWNER, OrgRole.ADMIN] },
			},
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

		const adminsList = admins.map((m) => ({
			id: m.id,
			ownerId: m.ownerId,
			role: m.role,
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

		return NextResponse.json({ admins: adminsList });
	} catch (error) {
		console.error("GET /api/orgs/:orgId/admins error:", error);
		return serverError("Failed to fetch admins");
	}
}

/**
 * POST /api/orgs/:orgId/admins
 * Add an admin to the org
 * Protected endpoint - requires OWNER role
 * 
 * Body: { userId: string }
 */
export async function POST(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { orgId } = await params;
		const body = await request.json();
		const { userId } = body;

		if (!userId || typeof userId !== "string") {
			return badRequest("userId is required");
		}

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
				{ error: "You must be an owner of this organization to add admins" },
				{ status: 403 }
			);
		}

		// Check target user exists
		const targetUser = await prisma.user.findUnique({ where: { id: userId } });
		if (!targetUser) {
			return notFound("User not found");
		}

		// Check if user already has membership
		const existingOwner = await prisma.owner.findFirst({
			where: { userId, orgId },
		});

		if (existingOwner) {
			const existingMembership = await prisma.orgMember.findUnique({
				where: { ownerId: existingOwner.id },
			});
			if (existingMembership) {
				// Update existing membership to ADMIN
				const updated = await prisma.orgMember.update({
					where: { id: existingMembership.id },
					data: { role: OrgRole.ADMIN },
				});
				return NextResponse.json({
					id: updated.id,
					ownerId: existingOwner.id,
					role: updated.role,
					message: "User promoted to admin",
				});
			}
		}

		// Create org-based owner for the user and membership as ADMIN
		const result = await prisma.$transaction(async (tx) => {
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

			const membership = await tx.orgMember.create({
				data: {
					orgId,
					ownerId: orgOwner.id,
					role: OrgRole.ADMIN,
				},
			});

			return { orgOwner, membership };
		});

		return NextResponse.json(
			{
				id: result.membership.id,
				ownerId: result.orgOwner.id,
				role: result.membership.role,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/orgs/:orgId/admins error:", error);
		return serverError("Failed to add admin");
	}
}
