import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { badRequest, serverError } from "@/lib/utils/errors";
import { validateAuthToken, validatePassword } from "@/lib/validations";
import { consumePasswordResetToken } from "@/lib/utils/server/auth-tokens";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { logAction } from "@/lib/utils/server/log";

/**
 * POST /api/auth/reset-password  { token, password }
 *
 * Validates the reset token, then sets the new password hash. The token is
 * consumed (single-use) inside consumePasswordResetToken.
 */
export async function POST(request: Request) {
	const limited = await enforceRateLimit(request, "reset-password", {
		maxRequests: 10,
		windowMs: 60 * 60 * 1000, // 1 hour
	});
	if (limited) return limited;

	let body: { token?: unknown; password?: unknown };
	try {
		body = await request.json();
	} catch {
		return badRequest("Request body must be valid JSON");
	}

	const { token, password } = body;

	if (!validateAuthToken(token)) {
		return badRequest("This password reset link is invalid or has expired.");
	}
	if (typeof password !== "string" || !validatePassword(password)) {
		return badRequest("Password must be at least 8 characters long");
	}

	try {
		// Hash first, then consume the token and write the password + tokenVersion bump in one
		// transaction (auth-tokens.consumePasswordResetToken). tokenVersion invalidates every
		// existing JWT — a reset logs out all active sessions. See the session callback in lib/auth.ts.
		const passwordHash = await bcrypt.hash(password, 10);
		const result = await consumePasswordResetToken(token, passwordHash);
		if (!result.ok) {
			return badRequest(result.error);
		}

		logAction("user.password_reset", result.userId);
		return NextResponse.json({ message: "Password updated. You can now log in." });
	} catch (error) {
		console.error("POST /api/auth/reset-password error:", error);
		return serverError("Failed to reset password");
	}
}
