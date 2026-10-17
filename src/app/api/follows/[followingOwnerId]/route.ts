import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { followStateOf } from "@/lib/utils/server/follow";
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

		const follow = type === "user"
			? await prisma.follow.findUnique({
				where: {
					followerId_followingUserId: {
						followerId: ctx.userId,
						followingUserId: targetId,
					},
				},
			})
			: await prisma.follow.findUnique({
				where: {
					followerId_followingPageId: {
						followerId: ctx.userId,
						followingPageId: targetId,
					},
				},
			});
		const requested = follow
			? false
			: await hasPendingFollowRequest(ctx.userId, { type: type === "user" ? "USER" : "PAGE", id: targetId });
		const state = followStateOf(!!follow, requested);
		return NextResponse.json({ isFollowing: state === "following", requested: state === "requested" });
	} catch (error) {
		console.error("GET /api/follows/:id error:", error);
		return serverError();
	}
}
