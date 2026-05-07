import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { canManagePage } from "@/lib/utils/server/permission";

type Params = { params: Promise<{ followingOwnerId: string }> };

/**
 * GET /api/follows/:id?type=user|page
 * Check if the current user follows a target user or page
 * Protected endpoint
 * Returns: { isFollowing: boolean }
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
			return NextResponse.json({ isFollowing: !!follow });
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
		return NextResponse.json({ isFollowing: !!follow });
	} catch (error) {
		console.error("GET /api/follows/:id error:", error);
		return serverError();
	}
}

/**
 * DELETE /api/follows/:id?type=user|page
 * Unfollow a user or page
 * Protected endpoint
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { followingOwnerId: targetId } = await params;
		const { searchParams } = new URL(request.url);
		const type = searchParams.get("type");
		const removeFollower = searchParams.get("removeFollower");

		if (type !== "user" && type !== "page") {
			return badRequest("Query param 'type' must be 'user' or 'page'");
		}

		// removeFollower mode: remove a specific user as a follower of targetId
		if (removeFollower) {
			if (type === "user") {
				if (targetId !== ctx.userId) return unauthorized("You can only remove followers from your own profile");
				const follow = await prisma.follow.findUnique({
					where: { followerId_followingUserId: { followerId: removeFollower, followingUserId: targetId } },
				});
				if (!follow) return notFound("Follow relationship not found");
				await prisma.follow.delete({ where: { id: follow.id } });
			} else {
				const isAdmin = await canManagePage(ctx.userId, targetId);
				if (!isAdmin) return unauthorized("You do not have permission to manage this page's followers");
				const follow = await prisma.follow.findUnique({
					where: { followerId_followingPageId: { followerId: removeFollower, followingPageId: targetId } },
				});
				if (!follow) return notFound("Follow relationship not found");
				await prisma.follow.delete({ where: { id: follow.id } });
			}
			return NextResponse.json({ success: true });
		}

		// Standard unfollow: current user unfollows targetId
		if (type === "user") {
			const follow = await prisma.follow.findUnique({
				where: {
					followerId_followingUserId: {
						followerId: ctx.userId,
						followingUserId: targetId,
					},
				},
			});

			if (!follow) {
				return notFound("Follow relationship not found");
			}

			await prisma.follow.delete({ where: { id: follow.id } });
			return NextResponse.json({ success: true });
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

		if (!follow) {
			return notFound("Follow relationship not found");
		}

		await prisma.follow.delete({ where: { id: follow.id } });
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/follows/:id error:", error);
		return serverError();
	}
}
