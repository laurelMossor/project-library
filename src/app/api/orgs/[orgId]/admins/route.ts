import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest, notFound } from "@/lib/utils/errors";
import { getUserOrgRole } from "@/lib/utils/server/org";
import { prisma } from "@/lib/utils/server/prisma";
import { OrgRole } from "@prisma/client";

/**
 * POST /api/orgs/[orgId]/admins
 * Add an admin to an org (requires OWNER or ADMIN role)
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ orgId: string }> }
) {
	const session = await auth();
	if (!session?.user?.id) {
		return unauthorized();
	}

	const { orgId } = await params;
	const { userId } = await request.json();

	if (!userId || typeof userId !== "string") {
		return badRequest("userId is required");
	}

	// Check if requester has permission (OWNER or ADMIN)
	const requesterRole = await getUserOrgRole(session.user.id, orgId);
	if (!requesterRole || (requesterRole !== OrgRole.OWNER && requesterRole !== OrgRole.ADMIN)) {
		return unauthorized("Only owners and admins can add other admins");
	}

	// Check if org exists
	const org = await prisma.org.findUnique({
		where: { id: orgId },
	});
	if (!org) {
		return notFound("Organization not found");
	}

	// Check if user exists
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});
	if (!user) {
		return notFound("User not found");
	}

	// Check if user is already a member
	const existingMembership = await prisma.orgMember.findUnique({
		where: {
			orgId_userId: {
				orgId,
				userId,
			},
		},
	});

	if (existingMembership) {
		// Update existing membership to ADMIN
		if (existingMembership.role === OrgRole.OWNER) {
			return badRequest("Cannot change owner role");
		}
		
		await prisma.orgMember.update({
			where: {
				orgId_userId: {
					orgId,
					userId,
				},
			},
			data: {
				role: OrgRole.ADMIN,
			},
		});
	} else {
		// Create new membership with ADMIN role
		await prisma.orgMember.create({
			data: {
				orgId,
				userId,
				role: OrgRole.ADMIN,
			},
		});
	}

	return NextResponse.json({ success: true });
}

/**
 * GET /api/orgs/[orgId]/admins
 * Get list of admins for an org
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ orgId: string }> }
) {
	const session = await auth();
	if (!session?.user?.id) {
		return unauthorized();
	}

	const { orgId } = await params;

	// Check if requester has permission (OWNER, ADMIN, or MEMBER)
	const requesterRole = await getUserOrgRole(session.user.id, orgId);
	if (!requesterRole || requesterRole === OrgRole.FOLLOWER) {
		return unauthorized("Only members can view admin list");
	}

	// Get all admins and owners
	const admins = await prisma.orgMember.findMany({
		where: {
			orgId,
			role: {
				in: [OrgRole.OWNER, OrgRole.ADMIN],
			},
		},
		include: {
			user: {
				select: {
					id: true,
					username: true,
					firstName: true,
					lastName: true,
					displayName: true,
					avatarImageId: true,
				},
			},
		},
		orderBy: [
			{ role: "asc" }, // OWNER first, then ADMIN
			{ createdAt: "asc" },
		],
	});

	return NextResponse.json({ admins });
}
