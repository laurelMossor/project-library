import { NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/utils/user";
import { getProjectsByUser } from "@/lib/utils/project";
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

		const projects = await getProjectsByUser(user.id);
		return NextResponse.json(projects);
	} catch (error) {
		console.error("Error fetching user projects:", error);
		return notFound("User not found");
	}
}

