import { NextResponse } from "next/server";
import { badRequest } from "@/lib/utils/errors";
import { validateAuthToken } from "@/lib/validations";
import { consumeEmailVerificationToken } from "@/lib/utils/server/auth-tokens";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";

/**
 * POST /api/auth/verify-email  { token }
 *
 * Consumes a verification token on a deliberate user action (button click).
 * Verification is intentionally NOT done on GET page-load: email link scanners
 * and prefetchers issue GET requests and would otherwise burn the one-time
 * token before the user ever clicks it.
 */
export async function POST(request: Request) {
	const limited = await enforceRateLimit(request, "verify-email", {
		maxRequests: 5,
		windowMs: 60 * 60 * 1000, // 1 hour
	});
	if (limited) return limited;

	let token: unknown;
	try {
		({ token } = await request.json());
	} catch {
		return badRequest("Request body must be valid JSON");
	}

	if (!validateAuthToken(token)) {
		return badRequest("This verification link is invalid or has expired.");
	}

	const result = await consumeEmailVerificationToken(token);
	if (!result.ok) {
		return badRequest(result.error);
	}

	return NextResponse.json({ ok: true });
}
