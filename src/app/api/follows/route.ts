import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";

/**
 * POST /api/follows
 * Follow another owner as the active owner
 * Protected endpoint
 * 
 * Body: { followingOwnerId: string }
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { followingOwnerId } = body;

		if (!followingOwnerId || typeof followingOwnerId !== "string") {
			return badRequest("followingOwnerId is required");
		}

		// Can't follow yourself
		if (followingOwnerId === ctx.activeOwnerId) {
			return badRequest("Cannot follow yourself");
		}

		// Verify target owner exists
		const targetOwner = await prisma.owner.findUnique({ where: { id: followingOwnerId } });
		if (!targetOwner) {
			return notFound("Owner to follow not found");
		}

		// Check if already following
		const existing = await prisma.follow.findUnique({
			where: {
				followerOwnerId_followingOwnerId: {
					followerOwnerId: ctx.activeOwnerId,
					followingOwnerId,
				},
			},
		});

		if (existing) {
			return badRequest("Already following this owner");
		}

		// Create follow
		const follow = await prisma.follow.create({
			data: {
				followerOwnerId: ctx.activeOwnerId,
				followingOwnerId,
			},
		});

		return NextResponse.json(
			{
				id: follow.id,
				followerOwnerId: follow.followerOwnerId,
				followingOwnerId: follow.followingOwnerId,
				createdAt: follow.createdAt,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/follows error:", error);
		return serverError();
	}
}
