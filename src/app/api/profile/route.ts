import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/user";
import { prisma } from "@/lib/prisma";

// GET /api/profile - Get current user's profile
export async function GET() {
	const session = await auth();

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = await getUserById(session.user.id);

	if (!user) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	return NextResponse.json(user);
}

// PUT /api/profile - Update current user's profile
export async function PUT(request: Request) {
	const session = await auth();

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { name, headline, bio, interests, location } = await request.json();

	const user = await prisma.user.update({
		where: { id: session.user.id },
		data: {
			name,
			headline,
			bio,
			interests: interests || [],
			location,
		},
		select: {
			id: true,
			username: true,
			name: true,
			headline: true,
			bio: true,
			interests: true,
			location: true,
		},
	});

	return NextResponse.json(user);
}
