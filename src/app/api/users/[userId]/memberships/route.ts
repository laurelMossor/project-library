import { NextResponse } from "next/server";
import { getUserMemberships } from "@/lib/utils/server/permission";
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
		const memberships = await getUserMemberships(userId);
		return NextResponse.json({ memberships });
	} catch (error) {
		console.error("GET /api/users/[userId]/memberships error:", error);
		return serverError("Failed to fetch memberships");
	}
}
