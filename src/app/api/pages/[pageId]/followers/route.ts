import { NextResponse } from "next/server";
import { getPageFollowers } from "@/lib/utils/server/follow";
import { serverError } from "@/lib/utils/errors";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ pageId: string }> }
) {
	try {
		const { pageId } = await params;
		const followers = await getPageFollowers(pageId);
		return NextResponse.json({ followers });
	} catch (error) {
		console.error("GET /api/pages/[pageId]/followers error:", error);
		return serverError("Failed to fetch followers");
	}
}
