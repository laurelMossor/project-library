import { prisma } from "@/lib/utils/server/prisma";
import { success, notFound, serverError } from "@/lib/utils/server/api-response";

type Params = { params: Promise<{ ownerId: string }> };

/**
 * GET /api/owners/:ownerId/followers
 * Get list of owners that follow this owner
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
			where: { followingOwnerId: ownerId },
			include: {
				follower: {
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

		return success({
			followers: follows.map((f) => ({
				ownerId: f.follower.id,
				type: f.follower.type,
				followedAt: f.createdAt,
				user: f.follower.user
					? {
							id: f.follower.user.id,
							username: f.follower.user.username,
							displayName: f.follower.user.displayName,
							firstName: f.follower.user.firstName,
							lastName: f.follower.user.lastName,
							avatarImageId: f.follower.user.avatarImageId,
					  }
					: null,
				org: f.follower.org
					? {
							id: f.follower.org.id,
							slug: f.follower.org.slug,
							name: f.follower.org.name,
							avatarImageId: f.follower.org.avatarImageId,
					  }
					: null,
			})),
		});
	} catch (error) {
		console.error("GET /api/owners/:ownerId/followers error:", error);
		return serverError();
	}
}
