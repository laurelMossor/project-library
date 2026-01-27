import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { getOrCreatePersonalOwner, getOrCreateOrgOwner } from "@/lib/utils/server/owner";
import { success, unauthorized, badRequest, serverError } from "@/lib/utils/server/api-response";
import { OwnerType, OwnerStatus, OrgRole } from "@prisma/client";

/**
 * POST /api/orgs
 * Create a new org
 * 
 * Body: { name: string, slug: string, bio?: string, ... }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { name, slug, bio, headline, location, isPublic } = body;

		if (!name || typeof name !== "string" || name.trim().length === 0) {
			return badRequest("name is required");
		}

		if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
			return badRequest("slug is required");
		}

		// Check slug uniqueness
		const existingOrg = await prisma.org.findUnique({ where: { slug } });
		if (existingOrg) {
			return badRequest("An org with this slug already exists");
		}

		// Create the org with a transaction:
		// 1. Create the org with the user's personal owner as the primary owner
		// 2. Create an org-based owner for the user
		// 3. Create OrgMember with OWNER role
		const result = await prisma.$transaction(async (tx) => {
			// Get or create user's personal owner to be the primary org owner
			const personalOwner = await getOrCreatePersonalOwner(ctx.userId);

			// Create the org
			const org = await tx.org.create({
				data: {
					name: name.trim(),
					slug: slug.trim().toLowerCase(),
					bio: bio || null,
					headline: headline || null,
					location: location || null,
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

		return success(
			{
				org: {
					id: result.org.id,
					slug: result.org.slug,
					name: result.org.name,
					bio: result.org.bio,
					headline: result.org.headline,
					isPublic: result.org.isPublic,
					createdAt: result.org.createdAt,
				},
				orgOwnerId: result.orgOwner.id,
			},
			201
		);
	} catch (error) {
		console.error("POST /api/orgs error:", error);
		return serverError();
	}
}

/**
 * GET /api/orgs
 * List orgs (public orgs, optionally filtered)
 * 
 * Query: ?topicId=...
 */
export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const topicId = url.searchParams.get("topicId");

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

		return success({ orgs });
	} catch (error) {
		console.error("GET /api/orgs error:", error);
		return serverError();
	}
}
