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
 * Validates invite token, marks it used, and creates the user in one transaction.
 */
export async function consumeInviteAndCreateUser(args: {
	normalizedEmail: string;
	username: string;
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

			const existingUser = await tx.user.findFirst({
				where: {
					OR: [{ email: args.normalizedEmail }, { username: args.username }],
				},
			});
			if (existingUser) {
				return {
					ok: false,
					error: "User with this email or username already exists",
				};
			}

			await tx.signupInvite.update({
				where: { id: invite.id },
				data: { usedAt: new Date() },
			});

			const user = await tx.user.create({
				data: {
					email: args.normalizedEmail,
					username: args.username,
					passwordHash: args.passwordHash,
					firstName: null,
					middleName: null,
					lastName: null,
				},
				select: { id: true },
			});

			return { ok: true, userId: user.id };
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : String(error);
		console.error("consumeInviteAndCreateUser:", message, error);
		return { ok: false, error: "Failed to create account" };
	}
}
