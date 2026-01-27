import { NextResponse } from "next/server";
import { getOwnerById } from "@/lib/utils/server/owner";
import { notFound, serverError } from "@/lib/utils/errors";

type Params = { params: Promise<{ ownerId: string }> };

/**
 * GET /api/owners/:ownerId
 * Get a public owner view with optional includes
 * Public endpoint
 * 
 * Query: ?include=user,org
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { ownerId } = await params;
		const url = new URL(request.url);
		const includeParam = url.searchParams.get("include") || "";
		const includes = includeParam.split(",").map((s) => s.trim());

		const includeUser = includes.includes("user");
		const includeOrg = includes.includes("org");

		const owner = await getOwnerById(ownerId, includeUser, includeOrg);

		if (!owner) {
			return notFound("Owner not found");
		}

		const response: Record<string, unknown> = {
			id: owner.id,
			type: owner.type,
			userId: owner.userId,
			orgId: owner.orgId,
			status: owner.status,
			createdAt: owner.createdAt,
		};

		if (includeUser && owner.user) {
			response.user = {
				id: owner.user.id,
				username: owner.user.username,
				displayName: owner.user.displayName,
				firstName: owner.user.firstName,
				lastName: owner.user.lastName,
			};
		}

		if (includeOrg && owner.org) {
			response.org = {
				id: owner.org.id,
				slug: owner.org.slug,
				name: owner.org.name,
			};
		}

		return NextResponse.json(response);
	} catch (error) {
		console.error("GET /api/owners/:ownerId error:", error);
		return serverError();
	}
}
