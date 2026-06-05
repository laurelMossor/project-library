import { NextResponse } from "next/server";
import { getUserFollowers } from "@/lib/utils/server/follow";
import { serverError, notFound } from "@/lib/utils/errors";
import { getViewerContext, canViewUser } from "@/lib/utils/server/visibility";
import { prisma } from "@/lib/utils/server/prisma";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		const { userId } = await params;
		const [user, viewer] = await Promise.all([
			prisma.user.findUnique({ where: { id: userId }, select: { id: true, visibility: true } }),
			getViewerContext(),
		]);

		if (!user) return notFound("User not found");

		// Followers list of a private user is restricted to followers of that user
		if (!(await canViewUser(user, viewer))) {
			return notFound("User not found");
		}

		const followers = await getUserFollowers(userId);
		return NextResponse.json({ followers });
	} catch (error) {
		console.error("GET /api/users/[userId]/followers error:", error);
		return serverError("Failed to fetch followers");
	}
}
