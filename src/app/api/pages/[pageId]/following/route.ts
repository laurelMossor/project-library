import { NextResponse } from "next/server";
import { getPageFollowing } from "@/lib/utils/server/follow";
import { serverError } from "@/lib/utils/errors";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ pageId: string }> }
) {
	try {
		const { pageId } = await params;
		const following = await getPageFollowing(pageId);
		return NextResponse.json({ following });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/following error:", error);
		return serverError("Failed to fetch following");
	}
}
