import { NextResponse } from "next/server";
import { getUserFollowing } from "@/lib/utils/server/follow";
import { serverError } from "@/lib/utils/errors";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		const { userId } = await params;
		const following = await getUserFollowing(userId);
		return NextResponse.json({ following });
	} catch (error) {
		console.error("GET /api/users/[userId]/following error:", error);
		return serverError("Failed to fetch following");
	}
}
