import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/utils/server/prisma";
import { getPagesForUser } from "@/lib/utils/server/permission";
import { getActivePageId } from "@/lib/utils/server/session";
import { unauthorized, serverError } from "@/lib/utils/errors";

/**
 * GET /api/me
 * Returns current user + their pages summary (for "switch hat" UI)
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
				handle: true,
				email: true,
				displayName: true,
				firstName: true,
				lastName: true,
				avatarImageId: true,
			},
		});

		if (!user) {
			return unauthorized("User not found");
		}

		// Get all pages for this user
		const pages = await getPagesForUser(userId);

		// Get active page ID from session
		const activePageId = await getActivePageId();

		return NextResponse.json({
			user: {
				id: user.id,
				handle: user.handle,
				email: user.email,
				displayName: user.displayName,
				firstName: user.firstName,
				lastName: user.lastName,
				avatarImageId: user.avatarImageId,
			},
			pages: pages.map((page) => ({
				id: page.id,
				name: page.name,
				handle: page.handle,
				avatarImageId: page.avatarImageId,
				role: page.role,
			})),
			activePageId,
		});
	} catch (error) {
		console.error("GET /api/me error:", error);
		return serverError();
	}
}
