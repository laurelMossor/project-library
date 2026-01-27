import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { notFound, serverError } from "@/lib/utils/errors";

type Params = { params: Promise<{ ownerId: string }> };

/**
 * GET /api/owners/:ownerId/following
 * Get list of owners that this owner follows
 * Public endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { ownerId } = await params;

		// Verify owner exists
		const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
		if (!owner) {
			return notFound("Owner not found");
		}

		const follows = await prisma.follow.findMany({
			where: { followerOwnerId: ownerId },
			include: {
				following: {
					include: {
						user: {
							select: {
								id: true,
								username: true,
								displayName: true,
								firstName: true,
								lastName: true,
								avatarImageId: true,
							},
						},
						org: {
							select: {
								id: true,
								slug: true,
								name: true,
								avatarImageId: true,
							},
						},
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		const following = follows.map((f) => ({
			ownerId: f.following.id,
			type: f.following.type,
			followedAt: f.createdAt,
			user: f.following.user
				? {
						id: f.following.user.id,
						username: f.following.user.username,
						displayName: f.following.user.displayName,
						firstName: f.following.user.firstName,
						lastName: f.following.user.lastName,
						avatarImageId: f.following.user.avatarImageId,
				  }
				: null,
			org: f.following.org
				? {
						id: f.following.org.id,
						slug: f.following.org.slug,
						name: f.following.org.name,
						avatarImageId: f.following.org.avatarImageId,
				  }
				: null,
		}));

		return NextResponse.json({ following });
	} catch (error) {
		console.error("GET /api/owners/:ownerId/following error:", error);
		return serverError();
	}
}
