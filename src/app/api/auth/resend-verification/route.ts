import { NextResponse, after } from "next/server";
import { badRequest } from "@/lib/utils/errors";
import { validateEmail, normalizeEmail } from "@/lib/validations";
import { prisma } from "@/lib/utils/server/prisma";
import { createEmailVerificationToken } from "@/lib/utils/server/auth-tokens";
import { sendVerificationEmail } from "@/lib/email/emails";
import { absoluteUrl } from "@/lib/utils/server/url";
import { VERIFY_EMAIL_WITH_TOKEN } from "@/lib/const/routes";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";

/**
 * POST /api/auth/resend-verification  { email }
 *
 * Re-issues a verification email if the account exists and is unverified.
 * Always responds 200 with the same body regardless of whether the email
 * exists or is already verified — no account enumeration. The email is
 * dispatched AFTER the response (see `after`) so response timing doesn't leak
 * account existence / verification state.
 */
export async function POST(request: Request) {
	const limited = await enforceRateLimit(request, "resend-verification", {
		maxRequests: 5,
		windowMs: 60 * 60 * 1000, // 1 hour
	});
	if (limited) return limited;

	let email: unknown;
	try {
		({ email } = await request.json());
	} catch {
		return badRequest("Request body must be valid JSON");
	}

	const normalizedEmail = normalizeEmail(email);
	if (!validateEmail(normalizedEmail)) {
		return badRequest("Invalid email format");
	}

	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
		select: { id: true, emailVerified: true },
	});

	// Only send when there's something to verify. Silent no-op otherwise.
	if (user && !user.emailVerified) {
		const userId = user.id;
		after(async () => {
			const { rawToken } = await createEmailVerificationToken(userId);
			await sendVerificationEmail(
				normalizedEmail,
				absoluteUrl(VERIFY_EMAIL_WITH_TOKEN(rawToken)),
			);
		});
	}

	return NextResponse.json({
		message: "If that account needs verification, we've sent a new link.",
	});
}
