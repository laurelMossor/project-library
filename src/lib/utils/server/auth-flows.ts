// ⚠️ SERVER-ONLY: The signed-out account flows behind src/lib/actions/auth.ts — password reset,
// email verification, and resend. Token mechanics live in auth-tokens.ts; this file is the
// input checks and the side effects around them. Refusals throw DomainError.
//
// Two flows (forgot password, resend verification) must not reveal whether an account exists:
// they return the same result either way and send the email AFTER the response (`after`), so
// neither the reply nor its timing leaks account existence.
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { validateAuthToken, validateEmail, validatePassword, normalizeEmail } from "@/lib/validations";
import { RESET_PASSWORD_WITH_TOKEN, VERIFY_EMAIL_WITH_TOKEN } from "@/lib/const/routes";
import { prisma } from "./prisma";
import { DomainError } from "./domain-error";
import {
	consumeEmailVerificationToken,
	consumePasswordResetToken,
	createEmailVerificationToken,
	createPasswordResetToken,
} from "./auth-tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email/emails";
import { absoluteUrl } from "./url";
import { logAction } from "./log";

function requireEmail(email: unknown): string {
	const normalized = normalizeEmail(email);
	if (!validateEmail(normalized)) throw new DomainError("Invalid email format");
	return normalized;
}

function requirePassword(password: unknown): string {
	if (typeof password !== "string" || !validatePassword(password)) {
		throw new DomainError("Password must be at least 8 characters long");
	}
	return password;
}

/** Email a reset link if the account exists. Same (void) result either way — no enumeration. */
export async function requestPasswordReset(email: unknown): Promise<void> {
	const normalizedEmail = requireEmail(email);
	const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
	if (!user) return;
	after(async () => {
		const { rawToken } = await createPasswordResetToken(user.id);
		await sendPasswordResetEmail(normalizedEmail, absoluteUrl(RESET_PASSWORD_WITH_TOKEN(rawToken)));
	});
}

/**
 * Set a new password from a reset link. The token is consumed (single-use) in the same transaction
 * as the password write and the tokenVersion bump, which invalidates every existing session.
 */
export async function resetPassword(token: unknown, password: unknown): Promise<void> {
	if (!validateAuthToken(token)) throw new DomainError("This password reset link is invalid or has expired.");
	const passwordHash = await bcrypt.hash(requirePassword(password), 10);
	const result = await consumePasswordResetToken(token, passwordHash);
	if (!result.ok) throw new DomainError(result.error);
	logAction("user.password_reset", result.userId);
}

/**
 * Consume a verification token. Called on a deliberate click, never on page load: link scanners
 * and prefetchers issue GETs and would otherwise burn the one-time token.
 */
export async function verifyEmail(token: unknown): Promise<void> {
	if (!validateAuthToken(token)) throw new DomainError("This verification link is invalid or has expired.");
	const result = await consumeEmailVerificationToken(token);
	if (!result.ok) throw new DomainError(result.error);
}

/** Re-send a verification link if the account exists and is unverified. Same result either way. */
export async function resendVerification(email: unknown): Promise<void> {
	const normalizedEmail = requireEmail(email);
	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
		select: { id: true, emailVerified: true },
	});
	if (!user || user.emailVerified) return;
	after(async () => {
		const { rawToken } = await createEmailVerificationToken(user.id);
		await sendVerificationEmail(normalizedEmail, absoluteUrl(VERIFY_EMAIL_WITH_TOKEN(rawToken)));
	});
}
