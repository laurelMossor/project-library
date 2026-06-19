import { NextResponse } from "next/server";
import { getUserFollowing } from "@/lib/utils/server/follow";
import { notFound, serverError } from "@/lib/utils/errors";
import { getViewerContext, requireViewableProfile } from "@/lib/utils/server/visibility";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		const { userId } = await params;
		const viewer = await getViewerContext();
		if (!(await requireViewableProfile("USER", userId, viewer))) {
			return notFound("User not found");
		}
		const following = await getUserFollowing(userId);
		return NextResponse.json({ following });
	} catch (error) {
		console.error("GET /api/users/[userId]/following error:", error);
		return serverError("Failed to fetch following");
	}
}
