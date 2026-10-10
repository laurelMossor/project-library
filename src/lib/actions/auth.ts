"use server";

import { publicAction } from "@/lib/utils/server/action";
import { signUp } from "@/lib/utils/server/signup";
import { requestPasswordReset, resendVerification, resetPassword, verifyEmail } from "@/lib/utils/server/auth-flows";
import { unsubscribeByToken } from "@/lib/utils/server/notification-preferences";
import type { SignupInput } from "@/lib/types/auth";

// The signed-out account flows. Each page moves on (or shows a confirmation) after the call, and
// none of them shows server-rendered data that changes, so every action skips the refresh. Limits
// are per client IP.

const HOUR = 60 * 60 * 1000;

/** Create an account from an invite (or the dev bypass). The page then sends them to check their inbox. */
export const signupAction = publicAction(async (_ctx, input: SignupInput) => {
	await signUp(input);
}, {
	refresh: false,
	rateLimit: { key: "signup", maxRequests: 5, windowMs: HOUR, message: "Too many signup attempts. Please try again later." },
});

/** Email a reset link if the account exists. Succeeds either way, so it can't reveal accounts. */
export const requestPasswordResetAction = publicAction(
	async (_ctx, input: { email: string }) => requestPasswordReset(input?.email),
	{ refresh: false, rateLimit: { key: "forgot-password", maxRequests: 5, windowMs: HOUR } },
);

/** Set a new password from a reset link (signs out every existing session). */
export const resetPasswordAction = publicAction(
	async (_ctx, input: { token: string; password: string }) => resetPassword(input?.token, input?.password),
	{ refresh: false, rateLimit: { key: "reset-password", maxRequests: 10, windowMs: HOUR } },
);

/** Confirm an email address from its verification link (a deliberate click, never on page load). */
export const verifyEmailAction = publicAction(
	async (_ctx, input: { token: string }) => verifyEmail(input?.token),
	{ refresh: false, rateLimit: { key: "verify-email", maxRequests: 5, windowMs: HOUR } },
);

/** Re-send a verification link if the account needs one. Succeeds either way. */
export const resendVerificationAction = publicAction(
	async (_ctx, input: { email: string }) => resendVerification(input?.email),
	{ refresh: false, rateLimit: { key: "resend-verification", maxRequests: 5, windowMs: HOUR } },
);

/** Confirm an email unsubscribe link; returns the context label for the confirmation copy. */
export const unsubscribeAction = publicAction(
	async (_ctx, input: { token: string }) => unsubscribeByToken(input?.token),
	{ refresh: false },
);
