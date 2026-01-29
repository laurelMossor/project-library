import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, badRequest } from "@/lib/utils/errors";

/**
 * GET /api/me/org
 * Get current active org's profile
 * Only works if currently acting as an org
 */
export async function GET() {
	const ctx = await getSessionContext();

	if (!ctx) {
		return unauthorized();
	}

	const owner = ctx.activeOwner;

	if (owner.type !== "ORG" || !owner.orgId) {
		return notFound("Not currently acting as an organization");
	}

	const org = await prisma.org.findUnique({
		where: { id: owner.orgId },
		select: {
			id: true,
			name: true,
			slug: true,
			headline: true,
			bio: true,
			interests: true,
			location: true,
			isPublic: true,
			addressLine1: true,
			addressLine2: true,
			city: true,
			state: true,
			zip: true,
			parentTopic: true,
			avatarImageId: true,
		},
	});

	if (!org) {
		return notFound("Organization not found");
	}

	return NextResponse.json(org);
}

/**
 * PUT /api/me/org
 * Update current active org's profile
 */
export async function PUT(request: Request) {
	const ctx = await getSessionContext();

	if (!ctx) {
		return unauthorized();
	}

	const owner = ctx.activeOwner;

	if (owner.type !== "ORG" || !owner.orgId) {
		return badRequest("Not currently acting as an organization");
	}

	try {
		const body = await request.json();
		const {
			headline,
			bio,
			interests,
			location,
			isPublic,
			addressLine1,
			addressLine2,
			city,
			state,
			zip,
			parentTopic,
			avatarImageId,
		} = body;

		const updatedOrg = await prisma.org.update({
			where: { id: owner.orgId },
			data: {
				headline,
				bio,
				interests: interests || [],
				location,
				isPublic,
				addressLine1,
				addressLine2,
				city,
				state,
				zip,
				parentTopic,
				avatarImageId,
			},
			select: {
				id: true,
				name: true,
				slug: true,
				headline: true,
				bio: true,
				interests: true,
				location: true,
				isPublic: true,
				addressLine1: true,
				addressLine2: true,
				city: true,
				state: true,
				zip: true,
				parentTopic: true,
				avatarImageId: true,
			},
		});

		return NextResponse.json(updatedOrg);
	} catch (error) {
		console.error("PUT /api/me/org error:", error);
		return badRequest("Failed to update organization");
	}
}
