import { NextResponse, after } from "next/server";
import { badRequest } from "@/lib/utils/errors";
import { validateEmail, normalizeEmail } from "@/lib/validations";
import { prisma } from "@/lib/utils/server/prisma";
import { createPasswordResetToken } from "@/lib/utils/server/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/email/emails";
import { absoluteUrl } from "@/lib/utils/server/url";
import { RESET_PASSWORD_WITH_TOKEN } from "@/lib/const/routes";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";

/**
 * POST /api/auth/forgot-password  { email }
 *
 * Sends a reset link if the account exists. Always responds 200 with the same
 * body regardless of whether the email exists — no account enumeration. The
 * email is dispatched AFTER the response (see `after`) so response timing
 * doesn't leak account existence via the email round-trip.
 */
export async function POST(request: Request) {
	const limited = await enforceRateLimit(request, "forgot-password", {
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
		select: { id: true },
	});

	if (user) {
		const userId = user.id;
		after(async () => {
			const { rawToken } = await createPasswordResetToken(userId);
			await sendPasswordResetEmail(
				normalizedEmail,
				absoluteUrl(RESET_PASSWORD_WITH_TOKEN(rawToken)),
			);
		});
	}

	return NextResponse.json({
		message: "If an account exists for that email, we've sent a reset link.",
	});
}
