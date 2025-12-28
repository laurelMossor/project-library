import { NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/utils/server/user";
import { getEventsByUser } from "@/lib/utils/server/event";
import { notFound } from "@/lib/utils/errors";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ username: string }> }
) {
	const { username } = await params;

	try {
		const user = await getUserByUsername(username);
		if (!user) {
			return notFound("User not found");
		}

		const events = await getEventsByUser(user.id);
		return NextResponse.json(events);
	} catch (error) {
		console.error("Error fetching user events:", error);
		return notFound("User not found");
	}
}

