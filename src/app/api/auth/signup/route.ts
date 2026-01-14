import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ActorType } from "@prisma/client";
import { prisma } from "@/lib/utils/server/prisma";
import { badRequest } from "@/lib/utils/errors";
import { validateEmail, validateUsername, validatePassword } from "@/lib/validations";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";

export async function POST(request: Request) {
	// Rate limiting: 5 signups per hour per IP
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`signup:${clientId}`, {
		maxRequests: 5,
		windowMs: 60 * 60 * 1000, // 1 hour
	});

	if (!rateLimit.allowed) {
		return NextResponse.json(
			{ error: "Too many signup attempts. Please try again later." },
			{ status: 429 }
		);
	}

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

	// Hash password
	const passwordHash = await bcrypt.hash(password, 10);

	// Create actor first (required for User)
	const actor = await prisma.actor.create({
		data: { type: ActorType.USER },
	});

	// Create user with actor reference
	const user = await prisma.user.create({
		data: {
			actorId: actor.id,
			email: normalizedEmail,
			passwordHash,
			username,
		},
	});

	return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}

