// ⚠️ SERVER-ONLY: Prisma + crypto

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

/** Default validity for new invites (script / future admin UI). */
export const SIGNUP_INVITE_TTL_DAYS = 14;

export function hashInviteToken(rawToken: string): string {
	return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function generateRawToken(): string {
	return randomBytes(32).toString("base64url");
}

/**
 * Create a pending invite. Returns the raw token once — store only hashInviteToken(rawToken) in DB.
 */
export async function createSignupInvite(
	email: string,
	options?: { expiresInDays?: number }
): Promise<{ rawToken: string; expiresAt: Date }> {
	const normalizedEmail = email.toLowerCase().trim();
	const rawToken = generateRawToken();
	const tokenHash = hashInviteToken(rawToken);
	const days = options?.expiresInDays ?? SIGNUP_INVITE_TTL_DAYS;
	const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

	await prisma.signupInvite.create({
		data: {
			email: normalizedEmail,
			tokenHash,
			expiresAt,
		},
	});

	return { rawToken, expiresAt };
}

export type ConsumeInviteResult =
	| { ok: true; userId: string }
	| { ok: false; error: string };

/**
 * Validates invite token, marks it used, and creates the user (with
 * companion Handle row) in one transaction.
 *
 * Caller is responsible for:
 *   - Lowercasing `handle` (per PR 2 normalization rule).
 *   - Running `validateHandle` + `isReservedHandle` + `isHandleTaken` first
 *     (the `isHandleTaken` check is a UX pre-check; the DB unique constraint
 *     on `handles.handle` is the actual guarantee).
 *
 * Email uniqueness is checked here inside the transaction; handle uniqueness
 * is enforced by the DB constraint and surfaces as Prisma `P2002`. If a
 * concurrent registration claims the handle between `isHandleTaken` and this
 * insert, the constraint throws and the catch block returns the friendly
 * "handle already taken" error instead of leaking the Prisma error.
 */
export async function consumeInviteAndCreateUser(args: {
	normalizedEmail: string;
	handle: string;
	passwordHash: string;
	rawInviteToken: string;
}): Promise<ConsumeInviteResult> {
	const tokenHash = hashInviteToken(args.rawInviteToken);

	try {
		return await prisma.$transaction(async (tx) => {
			const invite = await tx.signupInvite.findUnique({
				where: { tokenHash },
			});

			if (
				!invite ||
				invite.usedAt !== null ||
				invite.expiresAt < new Date() ||
				invite.email !== args.normalizedEmail
			) {
				return { ok: false, error: "Invalid or expired invitation" };
			}

			// Email uniqueness pre-check inside the tx. Handle uniqueness is
			// enforced by the cross-entity `handles.handle @unique` constraint
			// (caught below via P2002).
			const existingUser = await tx.user.findFirst({
				where: { email: args.normalizedEmail },
			});
			if (existingUser) {
				return {
					ok: false,
					error: "User with this email already exists",
				};
			}

			await tx.signupInvite.update({
				where: { id: invite.id },
				data: { usedAt: new Date() },
			});

			const user = await tx.user.create({
				data: {
					email: args.normalizedEmail,
					handle: args.handle,
					passwordHash: args.passwordHash,
					firstName: null,
					middleName: null,
					lastName: null,
					handleRecord: { create: { handle: args.handle } },
				},
				select: { id: true },
			});

			return { ok: true, userId: user.id };
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : String(error);
		// Prisma unique-constraint violation (P2002) when the handle was
		// claimed concurrently between isHandleTaken pre-check and write.
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: string }).code === "P2002"
		) {
			return { ok: false, error: "That handle is already taken" };
		}
		console.error("consumeInviteAndCreateUser:", message, error);
		return { ok: false, error: "Failed to create account" };
	}
}
