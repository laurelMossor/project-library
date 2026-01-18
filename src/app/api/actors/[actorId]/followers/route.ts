import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { notFound } from "@/lib/utils/errors";

/**
 * GET /api/actors/[actorId]/followers
 * Get list of actors following this actor
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ actorId: string }> }
) {
	const { actorId } = await params;

	// Check if actor exists
	const actor = await prisma.actor.findUnique({
		where: { id: actorId },
	});
	if (!actor) {
		return notFound("Actor not found");
	}

	// Get followers with their user/org data
	const follows = await prisma.follow.findMany({
		where: { followingId: actorId },
		include: {
			follower: {
				include: {
					user: {
						select: {
							id: true,
							actorId: true,
							username: true,
							firstName: true,
							lastName: true,
							displayName: true,
							avatarImageId: true,
						},
					},
					org: {
						select: {
							id: true,
							actorId: true,
							name: true,
							slug: true,
							avatarImageId: true,
						},
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	// Transform to include actor type and data
	const followers = follows.map((follow) => {
		const follower = follow.follower;
		if (follower.user) {
			return {
				type: "USER" as const,
				data: follower.user,
			};
		} else if (follower.org) {
			return {
				type: "ORG" as const,
				data: follower.org,
			};
		}
		return null;
	}).filter(Boolean);

	return NextResponse.json({ followers });
}
