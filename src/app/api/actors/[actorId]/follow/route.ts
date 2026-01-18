import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, badRequest, notFound } from "@/lib/utils/errors";
import { getActorIdForUser } from "@/lib/utils/server/actor";
import { prisma } from "@/lib/utils/server/prisma";

/**
 * POST /api/actors/[actorId]/follow
 * Follow an actor (user or org)
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ actorId: string }> }
) {
	const session = await auth();
	if (!session?.user?.id) {
		return unauthorized();
	}

	const { actorId } = await params;

	// Get the current user's actor ID
	const followerActorId = await getActorIdForUser(session.user.id);
	if (!followerActorId) {
		return badRequest("User actor not found");
	}

	// Prevent self-follow
	if (followerActorId === actorId) {
		return badRequest("Cannot follow yourself");
	}

	// Check if target actor exists
	const targetActor = await prisma.actor.findUnique({
		where: { id: actorId },
	});
	if (!targetActor) {
		return notFound("Actor not found");
	}

	try {
		// Check if already following
		const existingFollow = await prisma.follow.findFirst({
			where: {
				followerId: followerActorId,
				followingId: actorId,
			},
		});

		if (existingFollow) {
			return badRequest("Already following this actor");
		}

		// Create follow relationship
		await prisma.follow.create({
			data: {
				followerId: followerActorId,
				followingId: actorId,
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		return badRequest("Failed to follow actor");
	}
}

/**
 * DELETE /api/actors/[actorId]/follow
 * Unfollow an actor (user or org)
 */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ actorId: string }> }
) {
	const session = await auth();
	if (!session?.user?.id) {
		return unauthorized();
	}

	const { actorId } = await params;

	// Get the current user's actor ID
	const followerActorId = await getActorIdForUser(session.user.id);
	if (!followerActorId) {
		return badRequest("User actor not found");
	}

	try {
		// Delete follow relationship
		const follow = await prisma.follow.findFirst({
			where: {
				followerId: followerActorId,
				followingId: actorId,
			},
		});

		if (follow) {
			await prisma.follow.delete({
				where: { id: follow.id },
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		// If follow doesn't exist, that's fine - return success
		return NextResponse.json({ success: true });
	}
}

/**
 * GET /api/actors/[actorId]/follow
 * Check if current user is following this actor
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ actorId: string }> }
) {
	const session = await auth();
	if (!session?.user?.id) {
		return NextResponse.json({ isFollowing: false });
	}

	const { actorId } = await params;

	// Get the current user's actor ID
	const followerActorId = await getActorIdForUser(session.user.id);
	if (!followerActorId) {
		return NextResponse.json({ isFollowing: false });
	}

	const follow = await prisma.follow.findFirst({
		where: {
			followerId: followerActorId,
			followingId: actorId,
		},
	});

	return NextResponse.json({ isFollowing: !!follow });
}
