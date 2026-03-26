import { NextResponse } from "next/server";
import { getUserMemberships } from "@/lib/utils/server/permission";
import { serverError } from "@/lib/utils/errors";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ userId: string }> }
) {
	try {
		const { userId } = await params;
		const memberships = await getUserMemberships(userId);
		return NextResponse.json({ memberships });
	} catch (error) {
		console.error("GET /api/users/[userId]/memberships error:", error);
		return serverError("Failed to fetch memberships");
	}
}
