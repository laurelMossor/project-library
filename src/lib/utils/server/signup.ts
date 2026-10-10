// ⚠️ SERVER-ONLY: Account signup, behind `signupAction` in src/lib/actions/auth.ts.
//
// Creates a User and its companion Handle row atomically (createUser / consumeInviteAndCreateUser).
// The form collects the handle and display name; a caller that omits the handle (dev/E2E accounts)
// gets one generated from the email. A chosen handle fails loudly. A generated one is machine-picked,
// so a lost uniqueness race (P2002) is resolved by regenerating and retrying — never surfaced as an
// error the user can't act on. Refusals throw DomainError.
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { validateEmail, validatePassword, validateInviteToken, normalizeEmail } from "@/lib/validations";
import { VERIFY_EMAIL_WITH_TOKEN } from "@/lib/const/routes";
import type { SignupInput } from "@/lib/types/auth";
import { DomainError } from "./domain-error";
import { generateUniqueHandle, handleUnavailableReason } from "./handle";
import { consumeInviteAndCreateUser, type ConsumeInviteResult } from "./signup-invite";
import { claimPageEmailInvites } from "./requests";
import { isDevSignupBypassToken } from "./dev-signup-bypass";
import { prisma } from "./prisma";
import { createUser } from "./user";
import { logAction } from "./log";
import { createEmailVerificationToken } from "./auth-tokens";
import { sendVerificationEmail } from "./email/emails";
import { absoluteUrl } from "./url";

const isUniqueViolation = (err: unknown) =>
	typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";

/** Create the account and return its id. */
export async function signUp(input: SignupInput): Promise<string> {
	const { email, password, invite, handle: rawHandle, displayName: rawDisplayName } = input ?? ({} as SignupInput);
	if (!email || !password) throw new DomainError("Email and password are required");

	const inviteStr = typeof invite === "string" ? invite.trim() : "";
	const devBypass = isDevSignupBypassToken(inviteStr);
	if (!devBypass && !validateInviteToken(inviteStr)) {
		throw new DomainError("A valid invitation link is required to sign up");
	}

	const normalizedEmail = normalizeEmail(email);
	if (!validateEmail(normalizedEmail)) throw new DomainError("Invalid email format");
	if (typeof password !== "string" || !validatePassword(password)) {
		throw new DomainError("Password must be at least 8 characters long");
	}

	const chosenHandle = typeof rawHandle === "string" && rawHandle.trim() ? rawHandle.trim().toLowerCase() : null;
	if (chosenHandle) {
		const reason = await handleUnavailableReason(chosenHandle);
		if (reason) throw new DomainError(reason, "conflict");
	}
	const displayName =
		typeof rawDisplayName === "string" && rawDisplayName.trim() ? rawDisplayName.trim().slice(0, 100) : null;

	const passwordHash = await bcrypt.hash(password, 10);
	const maxHandleAttempts = chosenHandle ? 1 : 4;

	const userId = devBypass
		? await createDevAccount({ normalizedEmail, passwordHash, chosenHandle, displayName, maxHandleAttempts })
		: await createInvitedAccount({ normalizedEmail, passwordHash, chosenHandle, displayName, maxHandleAttempts, inviteStr });

	// Page invites sent to this address before the account existed land in notifications now.
	// Never fails the signup — the account is already created.
	try {
		await claimPageEmailInvites(userId, normalizedEmail);
	} catch (err) {
		logAction("user.signup.claim_page_invites_failed", userId, {
			error: err instanceof Error ? err.message : String(err),
		});
	}
	return userId;
}

type AccountDraft = {
	normalizedEmail: string;
	passwordHash: string;
	chosenHandle: string | null;
	displayName: string | null;
	maxHandleAttempts: number;
};

/**
 * Dev/E2E path: no invite to consume. Check the email up front (handle uniqueness is enforced by
 * the cross-entity DB constraint). These accounts are born verified — no email to click, and it
 * keeps the login-gated test suite green.
 */
async function createDevAccount(draft: AccountDraft): Promise<string> {
	const { normalizedEmail, passwordHash, chosenHandle, displayName, maxHandleAttempts } = draft;
	if (await prisma.user.findFirst({ where: { email: normalizedEmail } })) {
		throw new DomainError("User with this email already exists", "conflict");
	}
	for (let attempt = 0; attempt < maxHandleAttempts; attempt++) {
		const handle = chosenHandle ?? (await generateUniqueHandle(normalizedEmail));
		try {
			const { userId } = await createUser({
				email: normalizedEmail,
				handle,
				passwordHash,
				displayName: displayName ?? undefined,
				emailVerified: new Date(),
			});
			logAction("user.signup.dev_bypass", userId);
			return userId;
		} catch (err) {
			if (isUniqueViolation(err) && chosenHandle) throw new DomainError("That handle is already taken.", "conflict");
			if (isUniqueViolation(err) && attempt < maxHandleAttempts - 1) continue;
			throw err;
		}
	}
	throw new Error("unreachable: handle attempts exhausted");
}

/**
 * Invite path: consume the invite and create the account together. Then issue a verification token
 * and email it AFTER responding, so a token/email failure can't turn a created account into an
 * error — the user can always resend from the check-inbox or login pages.
 */
async function createInvitedAccount(draft: AccountDraft & { inviteStr: string }): Promise<string> {
	const { normalizedEmail, passwordHash, chosenHandle, displayName, maxHandleAttempts, inviteStr } = draft;
	let result: ConsumeInviteResult | null = null;
	for (let attempt = 0; attempt < maxHandleAttempts; attempt++) {
		const handle = chosenHandle ?? (await generateUniqueHandle(normalizedEmail));
		result = await consumeInviteAndCreateUser({ normalizedEmail, handle, passwordHash, rawInviteToken: inviteStr, displayName });
		// Retry only the handle race; any other failure (bad invite, email taken) is final.
		if (result.ok || !result.handleConflict) break;
	}
	if (!result || !result.ok) throw new DomainError(result?.error ?? "Failed to create account");

	const userId = result.userId;
	logAction("user.signup", userId);
	after(async () => {
		try {
			const { rawToken } = await createEmailVerificationToken(userId);
			await sendVerificationEmail(normalizedEmail, absoluteUrl(VERIFY_EMAIL_WITH_TOKEN(rawToken)));
		} catch (err) {
			logAction("user.signup.verification_email_failed", userId, {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	});
	return userId;
}
