import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { hasPendingFollowRequest } from "@/lib/utils/server/requests";

type Params = { params: Promise<{ followingOwnerId: string }> };

/**
 * GET /api/follows/:id?type=user|page
 * Check if the current user follows a target user or page
 * Protected endpoint
 * Returns: { isFollowing: boolean }
 *
 * Following, unfollowing and removing a follower are Server Actions (src/lib/actions/follow.ts).
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { followingOwnerId: targetId } = await params;
		const { searchParams } = new URL(request.url);
		const type = searchParams.get("type");

		if (type !== "user" && type !== "page") {
			return badRequest("Query param 'type' must be 'user' or 'page'");
		}

		if (type === "user") {
			const follow = await prisma.follow.findUnique({
				where: {
					followerId_followingUserId: {
						followerId: ctx.userId,
						followingUserId: targetId,
					},
				},
			});
			if (follow) return NextResponse.json({ isFollowing: true, requested: false });
			const requested = await hasPendingFollowRequest(ctx.userId, { type: "USER", id: targetId });
			return NextResponse.json({ isFollowing: false, requested });
		}

		// type === "page"
		const follow = await prisma.follow.findUnique({
			where: {
				followerId_followingPageId: {
					followerId: ctx.userId,
					followingPageId: targetId,
				},
			},
		});
		if (follow) return NextResponse.json({ isFollowing: true, requested: false });
		const requested = await hasPendingFollowRequest(ctx.userId, { type: "PAGE", id: targetId });
		return NextResponse.json({ isFollowing: false, requested });
	} catch (error) {
		console.error("GET /api/follows/:id error:", error);
		return serverError();
	}
}
