import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { requestOrCreateFollow } from "@/lib/utils/server/requests";

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

		// Requester is the personal identity. (Pages-as-followers is supported in
		// requests.ts but not yet initiated from the UI — see spec open decision.)
		const requester = { type: "USER" as const, id: ctx.userId };

		if (followingUserId) {
			if (typeof followingUserId !== "string") {
				return badRequest("followingUserId must be a string");
			}

			// Can't follow yourself
			if (followingUserId === ctx.userId) {
				return badRequest("Cannot follow yourself");
			}

			// Verify target user exists (and read its visibility for the gate)
			const targetUser = await prisma.user.findUnique({
				where: { id: followingUserId },
				select: { id: true, visibility: true },
			});
			if (!targetUser) {
				return notFound("User to follow not found");
			}

			// Already following?
			const existing = await prisma.follow.findUnique({
				where: { followerId_followingUserId: { followerId: ctx.userId, followingUserId } },
			});
			if (existing) {
				return badRequest("Already following this user");
			}

			const result = await requestOrCreateFollow(requester, {
				type: "USER",
				id: targetUser.id,
				visibility: targetUser.visibility,
			});
			return NextResponse.json(result, { status: 201 });
		}

		// followingPageId case
		if (typeof followingPageId !== "string") {
			return badRequest("followingPageId must be a string");
		}

		// Verify target page exists (and read its visibility for the gate)
		const targetPage = await prisma.page.findUnique({
			where: { id: followingPageId },
			select: { id: true, visibility: true },
		});
		if (!targetPage) {
			return notFound("Page to follow not found");
		}

		// Already following?
		const existing = await prisma.follow.findUnique({
			where: { followerId_followingPageId: { followerId: ctx.userId, followingPageId } },
		});
		if (existing) {
			return badRequest("Already following this page");
		}

		const result = await requestOrCreateFollow(requester, {
			type: "PAGE",
			id: targetPage.id,
			visibility: targetPage.visibility,
		});
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		console.error("POST /api/follows error:", error);
		return serverError();
	}
}
