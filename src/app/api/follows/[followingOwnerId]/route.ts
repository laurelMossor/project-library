import { NextResponse } from "next/server";
import { actingRef, getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, serverError } from "@/lib/utils/errors";
import { findFollowEdge, followStateOf } from "@/lib/utils/server/follow";
import { hasPendingFollowRequest } from "@/lib/utils/server/requests";
import type { EntityRef } from "@/lib/utils/server/activity";

type Params = { params: Promise<{ followingOwnerId: string }> };

/**
 * GET /api/follows/:id?type=user|page
 * Check if the acting identity (the current user, or the page they're acting as) follows a target
 * user or page
 * Protected endpoint
 * Returns: { isFollowing: boolean, requested: boolean }
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

		const follower = await actingRef(ctx);
		const target: EntityRef = { type: type === "user" ? "USER" : "PAGE", id: targetId };
		const follow = await findFollowEdge(follower, target);
		const requested = follow ? false : await hasPendingFollowRequest(follower, target);
		const state = followStateOf(!!follow, requested);
		return NextResponse.json({ isFollowing: state === "following", requested: state === "requested" });
	} catch (error) {
		console.error("GET /api/follows/:id error:", error);
		return serverError();
	}
}
