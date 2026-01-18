import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { notFound } from "@/lib/utils/errors";

/**
 * GET /api/actors/[actorId]/following
 * Get list of actors this actor is following
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

	// Get following with their user/org data
	const follows = await prisma.follow.findMany({
		where: { followerId: actorId },
		include: {
			following: {
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
	const following = follows.map((follow) => {
		const followingActor = follow.following;
		if (followingActor.user) {
			return {
				type: "USER" as const,
				data: followingActor.user,
			};
		} else if (followingActor.org) {
			return {
				type: "ORG" as const,
				data: followingActor.org,
			};
		}
		return null;
	}).filter(Boolean);

	return NextResponse.json({ following });
}
