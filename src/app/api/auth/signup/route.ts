import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
	const { email, password, username } = await request.json();

	// Basic validation
	if (!email || !password || !username) {
		return NextResponse.json(
			{ error: "Email, password, and username are required" },
			{ status: 400 }
		);
	}

	// Check if user already exists
	const existingUser = await prisma.user.findFirst({
		where: { OR: [{ email }, { username }] },
	});

	if (existingUser) {
		return NextResponse.json(
			{ error: "User with this email or username already exists" },
			{ status: 400 }
		);
	}

	// Hash password and create user
	const passwordHash = await bcrypt.hash(password, 10);
	const user = await prisma.user.create({
		data: { email, passwordHash, username },
	});

	return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}

