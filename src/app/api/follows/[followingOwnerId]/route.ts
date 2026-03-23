import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";

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
