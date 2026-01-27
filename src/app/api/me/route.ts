import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/utils/server/prisma";
import { getOwnersForUser } from "@/lib/utils/server/owner";
import { getActiveOwnerId } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/me
 * Returns current user + their owners summary (for "switch hat" UI)
 * Protected endpoint
 */
export async function GET() {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return unauthorized();
		}

		const userId = session.user.id;

		// Get user data
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				email: true,
				displayName: true,
				firstName: true,
				lastName: true,
				avatarImageId: true,
				ownerId: true,
			},
		});

		if (!user) {
			return unauthorized("User not found");
		}

		// Get all owners for this user
		const owners = await getOwnersForUser(userId);

		// Get active owner ID (from session or fallback to personal)
		const activeOwnerId = await getActiveOwnerId(userId);

		return NextResponse.json({
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				displayName: user.displayName,
				firstName: user.firstName,
				lastName: user.lastName,
				avatarImageId: user.avatarImageId,
				ownerId: user.ownerId,
			},
			owners: owners.map((owner) => ({
				id: owner.id,
				type: owner.type,
				orgId: owner.orgId,
				status: owner.status,
				org: owner.org
					? {
							id: owner.org.id,
							slug: owner.org.slug,
							name: owner.org.name,
							avatarImageId: owner.org.avatarImageId,
					  }
					: null,
			})),
			activeOwnerId,
		});
	} catch (error) {
		console.error("GET /api/me error:", error);
		return serverError();
	}
}
