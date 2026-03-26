import { NextResponse } from "next/server";
import { getUserFollowers } from "@/lib/utils/server/follow";
import { serverError } from "@/lib/utils/errors";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		const { userId } = await params;
		const followers = await getUserFollowers(userId);
		return NextResponse.json({ followers });
	} catch (error) {
		console.error("GET /api/users/[userId]/followers error:", error);
		return serverError("Failed to fetch followers");
	}
}
