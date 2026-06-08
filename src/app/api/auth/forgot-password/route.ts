import { NextResponse } from "next/server";
import { badRequest } from "@/lib/utils/errors";
import { validateEmail } from "@/lib/validations";
import { prisma } from "@/lib/utils/server/prisma";
import { createPasswordResetToken } from "@/lib/utils/server/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/email/emails";
import { absoluteUrl } from "@/lib/utils/server/url";
import { RESET_PASSWORD_WITH_TOKEN } from "@/lib/const/routes";
import { checkRateLimit, getClientIdentifier } from "@/lib/utils/server/rate-limit";

/**
 * POST /api/auth/forgot-password  { email }
 *
 * Sends a reset link if the account exists. Always responds 200 with the same
 * body regardless of whether the email exists — no account enumeration.
 */
export async function POST(request: Request) {
	const clientId = getClientIdentifier(request);
	const rateLimit = checkRateLimit(`forgot-password:${clientId}`, {
		maxRequests: 5,
		windowMs: 60 * 60 * 1000, // 1 hour
	});
	if (!rateLimit.allowed) {
		return NextResponse.json(
			{ error: "Too many requests. Please try again later." },
			{ status: 429 },
		);
	}

	let email: unknown;
	try {
		({ email } = await request.json());
	} catch {
		return badRequest("Request body must be valid JSON");
	}

	const normalizedEmail =
		typeof email === "string" ? email.toLowerCase().trim() : "";
	if (!validateEmail(normalizedEmail)) {
		return badRequest("Invalid email format");
	}

	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
		select: { id: true },
	});

	if (user) {
		const { rawToken } = await createPasswordResetToken(user.id);
		await sendPasswordResetEmail(
			normalizedEmail,
			absoluteUrl(RESET_PASSWORD_WITH_TOKEN(rawToken)),
		);
	}

	return NextResponse.json({
		message: "If an account exists for that email, we've sent a reset link.",
	});
}
