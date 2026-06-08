// ⚠️ SERVER-ONLY: Prisma + crypto
//
// Email-verification and password-reset tokens. Same security model as
// signup-invite.ts: a high-entropy raw token is emailed to the user and ONLY
// its SHA-256 hash is persisted. Tokens are single-use (usedAt) and time-boxed
// (expiresAt). Creating a fresh token for a user deletes that user's prior
// unused tokens of the same kind, so a resend / re-request never leaves
// multiple live tokens floating around.

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

export const EMAIL_VERIFICATION_TTL_HOURS = 24;
export const PASSWORD_RESET_TTL_HOURS = 1;

export function hashToken(rawToken: string): string {
	return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function generateRawToken(): string {
	return randomBytes(32).toString("base64url");
}

function expiryFromNow(hours: number): Date {
	return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export type ConsumeTokenResult =
	| { ok: true; userId: string }
	| { ok: false; error: string };

// ── Email verification ──────────────────────────────────────────────────────

/** Create a verification token for a user, invalidating prior unused ones. */
export async function createEmailVerificationToken(
	userId: string
): Promise<{ rawToken: string; expiresAt: Date }> {
	const rawToken = generateRawToken();
	const tokenHash = hashToken(rawToken);
	const expiresAt = expiryFromNow(EMAIL_VERIFICATION_TTL_HOURS);

	await prisma.$transaction([
		prisma.emailVerificationToken.deleteMany({
			where: { userId, usedAt: null },
		}),
		prisma.emailVerificationToken.create({
			data: { userId, tokenHash, expiresAt },
		}),
	]);

	return { rawToken, expiresAt };
}

/**
 * Validate a verification token and mark the user verified, atomically.
 * Idempotent-safe: an already-used or expired token returns a friendly error
 * rather than throwing.
 */
export async function consumeEmailVerificationToken(
	rawToken: string
): Promise<ConsumeTokenResult> {
	const tokenHash = hashToken(rawToken);

	return prisma.$transaction(async (tx) => {
		const token = await tx.emailVerificationToken.findUnique({
			where: { tokenHash },
		});

		if (!token || token.usedAt !== null || token.expiresAt < new Date()) {
			return { ok: false, error: "This verification link is invalid or has expired." };
		}

		await tx.emailVerificationToken.update({
			where: { id: token.id },
			data: { usedAt: new Date() },
		});
		await tx.user.update({
			where: { id: token.userId },
			data: { emailVerified: new Date() },
		});

		return { ok: true, userId: token.userId };
	});
}

// ── Password reset ───────────────────────────────────────────────────────────

/** Create a password-reset token for a user, invalidating prior unused ones. */
export async function createPasswordResetToken(
	userId: string
): Promise<{ rawToken: string; expiresAt: Date }> {
	const rawToken = generateRawToken();
	const tokenHash = hashToken(rawToken);
	const expiresAt = expiryFromNow(PASSWORD_RESET_TTL_HOURS);

	await prisma.$transaction([
		prisma.passwordResetToken.deleteMany({
			where: { userId, usedAt: null },
		}),
		prisma.passwordResetToken.create({
			data: { userId, tokenHash, expiresAt },
		}),
	]);

	return { rawToken, expiresAt };
}

/**
 * Validate a reset token and mark it used, atomically. Returns the userId so
 * the caller can update the password hash. Does NOT update the password itself
 * (keeps this util free of bcrypt / password policy concerns).
 */
export async function consumePasswordResetToken(
	rawToken: string
): Promise<ConsumeTokenResult> {
	const tokenHash = hashToken(rawToken);

	return prisma.$transaction(async (tx) => {
		const token = await tx.passwordResetToken.findUnique({
			where: { tokenHash },
		});

		if (!token || token.usedAt !== null || token.expiresAt < new Date()) {
			return { ok: false, error: "This password reset link is invalid or has expired." };
		}

		await tx.passwordResetToken.update({
			where: { id: token.id },
			data: { usedAt: new Date() },
		});

		return { ok: true, userId: token.userId };
	});
}
