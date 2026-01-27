import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { getOrCreatePersonalOwner } from "@/lib/utils/server/owner";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { validateOrgData } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";
import { OwnerType, OwnerStatus, OrgRole } from "@prisma/client";

/**
 * GET /api/orgs
 * List public orgs
 * Public endpoint
 */
export async function GET(request: Request) {
	// Rate limiting
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`search-orgs:${clientId}`, {
		maxRequests: 60,
		windowMs: 60 * 1000,
	});

	if (!rateLimit.allowed) {
		return NextResponse.json(
			{ error: "Too many requests. Please try again later." },
			{ status: 429 }
		);
	}

	const { searchParams } = new URL(request.url);
	const topicId = searchParams.get("topicId") || undefined;

	try {
		const orgs = await prisma.org.findMany({
			where: {
				isPublic: true,
				...(topicId ? { topics: { some: { id: topicId } } } : {}),
			},
			select: {
				id: true,
				slug: true,
				name: true,
				headline: true,
				bio: true,
				location: true,
				avatarImageId: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});

		return NextResponse.json(orgs);
	} catch (error) {
		console.error("GET /api/orgs error:", error);
		return serverError("Failed to fetch organizations");
	}
}

/**
 * POST /api/orgs
 * Create a new organization
 * Protected endpoint
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const data = await request.json();
		const { name, slug, bio, headline, location, interests, isPublic } = data;

		// Validate org data
		const validation = validateOrgData({
			name,
			slug,
			headline,
			bio,
			interests,
			location,
		});
		if (!validation.valid) {
			return badRequest(validation.error || "Invalid organization data");
		}

		// Check slug uniqueness
		const existingOrg = await prisma.org.findUnique({ where: { slug: slug.toLowerCase() } });
		if (existingOrg) {
			return badRequest("An organization with this URL already exists");
		}

		// Create org in a transaction
		const result = await prisma.$transaction(async (tx) => {
			// Get or create user's personal owner to be the primary org owner
			const personalOwner = await getOrCreatePersonalOwner(ctx.userId);

			// Create the org
			const org = await tx.org.create({
				data: {
					name: name.trim(),
					slug: slug.trim().toLowerCase(),
					bio: bio?.trim() || null,
					headline: headline?.trim() || null,
					location: location?.trim() || null,
					interests: Array.isArray(interests) ? interests : [],
					isPublic: isPublic !== false,
					createdByUserId: ctx.userId,
					ownerId: personalOwner.id,
				},
			});

			// Create an org-based owner for this user
			const orgOwner = await tx.owner.create({
				data: {
					userId: ctx.userId,
					orgId: org.id,
					type: OwnerType.ORG,
					status: OwnerStatus.ACTIVE,
				},
			});

			// Create OrgMember with OWNER role
			await tx.orgMember.create({
				data: {
					orgId: org.id,
					ownerId: orgOwner.id,
					role: OrgRole.OWNER,
				},
			});

			return { org, orgOwner };
		});

		return NextResponse.json(
			{
				id: result.org.id,
				slug: result.org.slug,
				name: result.org.name,
				bio: result.org.bio,
				headline: result.org.headline,
				location: result.org.location,
				isPublic: result.org.isPublic,
				createdAt: result.org.createdAt,
				orgOwnerId: result.orgOwner.id,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/orgs error:", error);
		return serverError("Failed to create organization");
	}
}
