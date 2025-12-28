import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/utils/prisma";
import { badRequest } from "@/lib/utils/errors";
import { validateEmail, validateUsername, validatePassword } from "@/lib/validations";

export async function POST(request: Request) {
	const { email, password, username } = await request.json();

	// Basic validation - check all required fields are present
	if (!email || !password || !username) {
		return badRequest("Email, password, and username are required");
	}

	// Normalize email to lowercase for case-insensitive storage and lookup
	const normalizedEmail = email.toLowerCase().trim();

	// Validate email format
	if (!validateEmail(normalizedEmail)) {
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

	// Check if user already exists (use normalized email)
	const existingUser = await prisma.user.findFirst({
		where: { OR: [{ email: normalizedEmail }, { username }] },
	});

	if (existingUser) {
		return badRequest("User with this email or username already exists");
	}

	// Hash password and create user (store normalized email)
	const passwordHash = await bcrypt.hash(password, 10);
	const user = await prisma.user.create({
		data: { email: normalizedEmail, passwordHash, username },
	});

	return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}

