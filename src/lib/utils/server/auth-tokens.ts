// ⚠️ SERVER-ONLY: Prisma + crypto
//
// Email-verification and password-reset tokens. Same security model as
// signup-invite.ts: a high-entropy raw token is emailed to the user and ONLY
// its SHA-256 hash is persisted. Tokens are single-use (usedAt) and time-boxed
// (expiresAt). Creating a fresh token for a user deletes that user's prior
// unused tokens of the same kind, so a resend / re-request never leaves
// multiple live tokens floating around.
//
// EmailVerificationToken and PasswordResetToken are structurally identical, so
// the create/consume logic lives in two generic helpers parametrized by the
// Prisma model delegate. The verify flow's extra side-effect (marking the user
// verified) is injected via the `onConsume` hook.

import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
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

// ── Generic token engine ─────────────────────────────────────────────────────
//
// Prisma generates a distinct (non-shared) delegate type per model, so we
// describe the minimal surface we use and select the delegate off whichever
// client we hold — the base client for the create batch, the tx client inside
// consume. The structural cast is contained to the two selectors below.

type TokenClient = typeof prisma | Prisma.TransactionClient;

interface TokenRecord {
	id: string;
	userId: string;
	expiresAt: Date;
	usedAt: Date | null;
}

interface TokenDelegate {
	findUnique(args: { where: { tokenHash: string } }): Promise<TokenRecord | null>;
	create(args: { data: { userId: string; tokenHash: string; expiresAt: Date } }): Prisma.PrismaPromise<unknown>;
	deleteMany(args: { where: { userId: string; usedAt: null } }): Prisma.PrismaPromise<unknown>;
	update(args: { where: { id: string }; data: { usedAt: Date } }): Promise<unknown>;
}

type DelegateSelector = (client: TokenClient) => TokenDelegate;

const emailVerificationDelegate: DelegateSelector = (c) =>
	c.emailVerificationToken as unknown as TokenDelegate;
const passwordResetDelegate: DelegateSelector = (c) =>
	c.passwordResetToken as unknown as TokenDelegate;

/** Create a single-use token for a user, invalidating their prior unused ones. */
async function createUserToken(
	select: DelegateSelector,
	userId: string,
	ttlHours: number,
): Promise<{ rawToken: string; expiresAt: Date }> {
	const rawToken = generateRawToken();
	const tokenHash = hashToken(rawToken);
	const expiresAt = expiryFromNow(ttlHours);
	const delegate = select(prisma);

	await prisma.$transaction([
		delegate.deleteMany({ where: { userId, usedAt: null } }),
		delegate.create({ data: { userId, tokenHash, expiresAt } }),
	]);

	return { rawToken, expiresAt };
}

/**
 * Validate a token and mark it used, atomically. `onConsume` runs inside the
 * same transaction for any extra side-effect (e.g. marking the user verified).
 * An already-used or expired token returns a friendly error rather than throwing.
 */
async function consumeUserToken(
	select: DelegateSelector,
	rawToken: string,
	invalidMessage: string,
	onConsume?: (tx: Prisma.TransactionClient, userId: string) => Promise<unknown>,
): Promise<ConsumeTokenResult> {
	const tokenHash = hashToken(rawToken);

	return prisma.$transaction(async (tx) => {
		const delegate = select(tx);
		const token = await delegate.findUnique({ where: { tokenHash } });

		if (!token || token.usedAt !== null || token.expiresAt < new Date()) {
			return { ok: false, error: invalidMessage };
		}

		await delegate.update({ where: { id: token.id }, data: { usedAt: new Date() } });
		await onConsume?.(tx, token.userId);

		return { ok: true, userId: token.userId };
	});
}

// ── Email verification ──────────────────────────────────────────────────────

/** Create a verification token for a user, invalidating prior unused ones. */
export function createEmailVerificationToken(
	userId: string,
): Promise<{ rawToken: string; expiresAt: Date }> {
	return createUserToken(emailVerificationDelegate, userId, EMAIL_VERIFICATION_TTL_HOURS);
}

/** Validate a verification token and mark the user verified, atomically. */
export function consumeEmailVerificationToken(rawToken: string): Promise<ConsumeTokenResult> {
	return consumeUserToken(
		emailVerificationDelegate,
		rawToken,
		"This verification link is invalid or has expired.",
		(tx, userId) =>
			tx.user.update({ where: { id: userId }, data: { emailVerified: new Date() } }),
	);
}

// ── Password reset ───────────────────────────────────────────────────────────

/** Create a password-reset token for a user, invalidating prior unused ones. */
export function createPasswordResetToken(
	userId: string,
): Promise<{ rawToken: string; expiresAt: Date }> {
	return createUserToken(passwordResetDelegate, userId, PASSWORD_RESET_TTL_HOURS);
}

/**
 * Validate a reset token and mark it used, atomically. Returns the userId so
 * the caller can update the password hash. Does NOT update the password itself
 * (keeps this util free of bcrypt / password policy concerns).
 */
export function consumePasswordResetToken(rawToken: string): Promise<ConsumeTokenResult> {
	return consumeUserToken(
		passwordResetDelegate,
		rawToken,
		"This password reset link is invalid or has expired.",
	);
}
