import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { badRequest, serverError } from "@/lib/utils/errors";
import {
	validateEmail,
	validateHandle,
	validatePassword,
	validateInviteToken,
} from "@/lib/validations";
import { isReservedHandle } from "@/lib/const/reserved-handles";
import { isHandleTaken } from "@/lib/utils/server/handle";
import { consumeInviteAndCreateUser } from "@/lib/utils/server/signup-invite";
import { isDevSignupBypassToken } from "@/lib/utils/server/dev-signup-bypass";
import { prisma } from "@/lib/utils/server/prisma";
import { createUser } from "@/lib/utils/server/user";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";
import { logAction } from "@/lib/utils/server/log";

/**
 * POST /api/auth/signup
 *
 * Creates a User and its companion Handle row atomically (per PR 2's
 * cross-entity uniqueness model). The accepted JSON field is `handle`
 * (formerly `username`); pre-PR2 client code that still sends `username`
 * would not work — this is a pre-beta breaking change, intentional.
 *
 * Validation order:
 *   1. Format     — `validateHandle` (lowercase + length + charset)
 *   2. Reserved   — `isReservedHandle` (would shadow a top-level route)
 *   3. Uniqueness — `isHandleTaken` (UX pre-check; DB constraint is the gate)
 *
 * Then the actual write happens in `createUser` / `consumeInviteAndCreateUser`,
 * both of which create the User and Handle rows atomically (nested write +
 * `$transaction`). If a handle race-condition collides between step 3 and
 * the write, Prisma's P2002 surface is caught and returned as a friendly error.
 */
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
		const { email, password, handle, invite } = await request.json();

		if (!email || !password || !handle) {
			return badRequest("Email, password, and handle are required");
		}

		const inviteStr = typeof invite === "string" ? invite.trim() : "";
		const devBypass = isDevSignupBypassToken(inviteStr);
		if (!devBypass && !validateInviteToken(inviteStr)) {
			return badRequest("A valid invitation link is required to sign up");
		}

		const normalizedEmail = email.toLowerCase().trim();
		// PR 2 normalization rule: handles are stored lowercase. Lowercasing
		// here means everything downstream (validators, taken-check, write)
		// works against the canonical form.
		const normalizedHandle =
			typeof handle === "string" ? handle.toLowerCase().trim() : "";

		if (!validateEmail(normalizedEmail)) {
			return badRequest("Invalid email format");
		}

		if (!validateHandle(normalizedHandle)) {
			return badRequest(
				"Handle must be 3–30 characters and contain only lowercase letters, numbers, underscores, and hyphens",
			);
		}

		if (isReservedHandle(normalizedHandle)) {
			return badRequest("That handle is reserved. Please choose another.");
		}

		if (await isHandleTaken(normalizedHandle)) {
			return badRequest("That handle is already taken");
		}

		if (!validatePassword(password)) {
			return badRequest("Password must be at least 8 characters long");
		}

		const passwordHash = await bcrypt.hash(password, 10);

		let responseUserId: string;

		if (devBypass) {
			// Dev-bypass path: just check email collision (handle uniqueness
			// is enforced by the cross-entity DB constraint via createUser).
			const existingUser = await prisma.user.findFirst({
				where: { email: normalizedEmail },
			});
			if (existingUser) {
				return badRequest("User with this email already exists");
			}
			try {
				const { userId } = await createUser({
					email: normalizedEmail,
					handle: normalizedHandle,
					passwordHash,
				});
				responseUserId = userId;
			} catch (err) {
				if (
					typeof err === "object" &&
					err !== null &&
					"code" in err &&
					(err as { code?: string }).code === "P2002"
				) {
					return badRequest("That handle is already taken");
				}
				throw err;
			}
			logAction("user.signup.dev_bypass", responseUserId);
		} else {
			const result = await consumeInviteAndCreateUser({
				normalizedEmail,
				handle: normalizedHandle,
				passwordHash,
				rawInviteToken: inviteStr,
			});

			if (!result.ok) {
				return badRequest(result.error);
			}

			responseUserId = result.userId;
			logAction("user.signup", responseUserId);
		}

		return NextResponse.json(
			{
				id: responseUserId,
				email: normalizedEmail,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/auth/signup error:", error);
		return serverError("Failed to create account");
	}
}
