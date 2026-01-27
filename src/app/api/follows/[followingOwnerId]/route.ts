import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";

type Params = { params: Promise<{ followingOwnerId: string }> };

/**
 * DELETE /api/follows/:followingOwnerId
 * Unfollow an owner as the active owner
 * Protected endpoint
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { followingOwnerId } = await params;

		// Find the follow relationship
		const follow = await prisma.follow.findUnique({
			where: {
				followerOwnerId_followingOwnerId: {
					followerOwnerId: ctx.activeOwnerId,
					followingOwnerId,
				},
			},
		});

		if (!follow) {
			return notFound("Follow relationship not found");
		}

		// Delete the follow
		await prisma.follow.delete({
			where: { id: follow.id },
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/follows/:followingOwnerId error:", error);
		return serverError();
	}
}
