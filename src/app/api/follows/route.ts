import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { logAction } from "@/lib/utils/server/log";

/**
 * POST /api/follows
 * Follow a user or page
 * Protected endpoint
 *
 * Body: { followingUserId?: string, followingPageId?: string }
 * Exactly one of followingUserId or followingPageId must be provided.
 */
export async function POST(request: Request) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const body = await request.json();
		const { followingUserId, followingPageId } = body;

		// Exactly one must be provided
		if ((!followingUserId && !followingPageId) || (followingUserId && followingPageId)) {
			return badRequest("Exactly one of followingUserId or followingPageId must be provided");
		}

		if (followingUserId) {
			if (typeof followingUserId !== "string") {
				return badRequest("followingUserId must be a string");
			}

			// Can't follow yourself
			if (followingUserId === ctx.userId) {
				return badRequest("Cannot follow yourself");
			}

			// Verify target user exists
			const targetUser = await prisma.user.findUnique({ where: { id: followingUserId } });
			if (!targetUser) {
				return notFound("User to follow not found");
			}

			// Check if already following
			const existing = await prisma.follow.findUnique({
				where: {
					followerId_followingUserId: {
						followerId: ctx.userId,
						followingUserId,
					},
				},
			});

			if (existing) {
				return badRequest("Already following this user");
			}

			const follow = await prisma.follow.create({
				data: {
					followerId: ctx.userId,
					followingUserId,
				},
			});

			logAction("follow.created", ctx.userId, { followingUserId });

			return NextResponse.json(
				{
					id: follow.id,
					followerId: follow.followerId,
					followingUserId: follow.followingUserId,
					createdAt: follow.createdAt,
				},
				{ status: 201 }
			);
		}

		// followingPageId case
		if (typeof followingPageId !== "string") {
			return badRequest("followingPageId must be a string");
		}

		// Verify target page exists
		const targetPage = await prisma.page.findUnique({ where: { id: followingPageId } });
		if (!targetPage) {
			return notFound("Page to follow not found");
		}

		// Check if already following
		const existing = await prisma.follow.findUnique({
			where: {
				followerId_followingPageId: {
					followerId: ctx.userId,
					followingPageId,
				},
			},
		});

		if (existing) {
			return badRequest("Already following this page");
		}

		const follow = await prisma.follow.create({
			data: {
				followerId: ctx.userId,
				followingPageId,
			},
		});

		logAction("follow.created", ctx.userId, { followingPageId });

		return NextResponse.json(
			{
				id: follow.id,
				followerId: follow.followerId,
				followingPageId: follow.followingPageId,
				createdAt: follow.createdAt,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/follows error:", error);
		return serverError();
	}
}
