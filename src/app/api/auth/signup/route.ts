import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/errors";
import { validateEmail, validateUsername, validatePassword } from "@/lib/validations";

export async function POST(request: Request) {
	const { email, password, username } = await request.json();

	// Basic validation - check all required fields are present
	if (!email || !password || !username) {
		return badRequest("Email, password, and username are required");
	}

	// Validate email format
	if (!validateEmail(email)) {
		return badRequest("Invalid email format");
	}

	// Validate username format
	if (!validateUsername(username)) {
		return badRequest("Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens");
	}

	// Validate password strength
	if (!validatePassword(password)) {
		return badRequest("Password must be at least 8 characters long");
	}

	// Check if user already exists
	const existingUser = await prisma.user.findFirst({
		where: { OR: [{ email }, { username }] },
	});

	if (existingUser) {
		return badRequest("User with this email or username already exists");
	}

	// Hash password and create user
	const passwordHash = await bcrypt.hash(password, 10);
	const user = await prisma.user.create({
		data: { email, passwordHash, username },
	});

	return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}

