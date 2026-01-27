import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { OwnerType, OwnerStatus } from "@prisma/client";
import { prisma } from "@/lib/utils/server/prisma";
import { badRequest, serverError } from "@/lib/utils/errors";
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

	try {
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

		// Create user and personal owner in a transaction
		const result = await prisma.$transaction(async (tx) => {
			// Create user first (without ownerId)
			const user = await tx.user.create({
				data: {
					email: normalizedEmail,
					passwordHash,
					username,
				},
			});

			// Create personal owner for the user
			const owner = await tx.owner.create({
				data: {
					userId: user.id,
					type: OwnerType.USER,
					status: OwnerStatus.ACTIVE,
					// orgId is null for personal owner
				},
			});

			// Update user with ownerId (personal owner reference)
			await tx.user.update({
				where: { id: user.id },
				data: { ownerId: owner.id },
			});

			return { user, owner };
		});

		return NextResponse.json(
			{
				id: result.user.id,
				email: result.user.email,
				ownerId: result.owner.id,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/auth/signup error:", error);
		return serverError("Failed to create account");
	}
}
