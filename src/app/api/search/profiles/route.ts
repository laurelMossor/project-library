import { NextResponse } from "next/server";
import { searchProfiles } from "@/lib/utils/server/search";
import { serverError } from "@/lib/utils/errors";
import { getViewerContext } from "@/lib/utils/server/visibility";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const query = searchParams.get("q")?.trim() ?? "";
	const type = (searchParams.get("type") ?? "all") as "user" | "page" | "all";

	if (query.length < 2) {
		return NextResponse.json({ results: [] });
	}

	try {
		const viewer = await getViewerContext();
		const results = await searchProfiles(query, { type, viewer });
		return NextResponse.json({ results });
	} catch (error) {
		console.error("GET /api/search/profiles error:", error);
		return serverError("Failed to search profiles");
	}
}
