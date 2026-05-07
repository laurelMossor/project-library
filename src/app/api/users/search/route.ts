import { NextResponse } from "next/server";
import { searchUsers } from "@/lib/utils/server/user";
import { serverError } from "@/lib/utils/errors";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const query = searchParams.get("q")?.trim() ?? "";

	if (query.length < 2) {
		return NextResponse.json({ users: [] });
	}

	try {
		const users = await searchUsers(query);
		return NextResponse.json({ users });
	} catch (error) {
		console.error("GET /api/users/search error:", error);
		return serverError("Failed to search users");
	}
}
