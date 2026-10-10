import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import { badRequest, serverError } from "@/lib/utils/errors";
import {
	validateEmail,
	validatePassword,
	validateInviteToken,
	normalizeEmail,
} from "@/lib/validations";
import { generateUniqueHandle, handleUnavailableReason } from "@/lib/utils/server/handle";
import { consumeInviteAndCreateUser, type ConsumeInviteResult } from "@/lib/utils/server/signup-invite";
import { claimPageEmailInvites } from "@/lib/utils/server/requests";
import { isDevSignupBypassToken } from "@/lib/utils/server/dev-signup-bypass";
import { prisma } from "@/lib/utils/server/prisma";
import { createUser } from "@/lib/utils/server/user";
import { enforceRateLimit } from "@/lib/utils/server/rate-limit";
import { logAction } from "@/lib/utils/server/log";
import { createEmailVerificationToken } from "@/lib/utils/server/auth-tokens";
import { sendVerificationEmail } from "@/lib/utils/server/email/emails";
import { absoluteUrl } from "@/lib/utils/server/url";
import { VERIFY_EMAIL_WITH_TOKEN } from "@/lib/const/routes";

/**
 * POST /api/auth/signup
 *
 * Creates a User and its companion Handle row atomically (per PR 2's cross-entity
 * uniqueness model). The form collects the handle and display name; a caller that omits the
 * handle (dev/E2E accounts) gets one generated from the email via `generateUniqueHandle`. The write
 * happens in `createUser` / `consumeInviteAndCreateUser`, both of which create the User and
 * Handle rows atomically. Because the handle is machine-picked, a lost uniqueness race
 * (P2002) is resolved by regenerating and retrying — never surfaced as an error the user
 * can't act on.
 */
export async function POST(request: Request) {
	// Rate limiting: 5 signups per hour per IP
	const limited = await enforceRateLimit(
		request,
		"signup",
		{ maxRequests: 5, windowMs: 60 * 60 * 1000 },
		"Too many signup attempts. Please try again later.",
	);
	if (limited) return limited;

	try {
		const { email, password, invite, handle: rawHandle, displayName: rawDisplayName } = await request.json();

		if (!email || !password) {
			return badRequest("Email and password are required");
		}

		const inviteStr = typeof invite === "string" ? invite.trim() : "";
		const devBypass = isDevSignupBypassToken(inviteStr);
		if (!devBypass && !validateInviteToken(inviteStr)) {
			return badRequest("A valid invitation link is required to sign up");
		}

		const normalizedEmail = normalizeEmail(email);

		if (!validateEmail(normalizedEmail)) {
			return badRequest("Invalid email format");
		}

		if (!validatePassword(password)) {
			return badRequest("Password must be at least 8 characters long");
		}

		// The person picks their handle on the signup form. Callers that omit it (dev/E2E accounts)
		// get a generated one. A chosen handle fails loudly; a generated one is retried on a race.
		const chosenHandle = typeof rawHandle === "string" && rawHandle.trim()
			? rawHandle.trim().toLowerCase()
			: null;
		if (chosenHandle) {
			const reason = await handleUnavailableReason(chosenHandle);
			if (reason) return badRequest(reason);
		}
		const displayName = typeof rawDisplayName === "string" && rawDisplayName.trim()
			? rawDisplayName.trim().slice(0, 100)
			: null;

		const passwordHash = await bcrypt.hash(password, 10);

		const MAX_HANDLE_ATTEMPTS = chosenHandle ? 1 : 4;

		let responseUserId: string;

		if (devBypass) {
			// Dev-bypass path: check email collision up front (handle uniqueness is enforced by
			// the cross-entity DB constraint via createUser).
			const existingUser = await prisma.user.findFirst({
				where: { email: normalizedEmail },
			});
			if (existingUser) {
				return badRequest("User with this email already exists");
			}
			let userId: string | null = null;
			for (let attempt = 0; attempt < MAX_HANDLE_ATTEMPTS && userId === null; attempt++) {
				const handle = chosenHandle ?? await generateUniqueHandle(normalizedEmail);
				try {
					const created = await createUser({
						email: normalizedEmail,
						handle,
						passwordHash,
						displayName: displayName ?? undefined,
						// Local / E2E accounts are born verified — no email to click,
						// and it keeps the login-gated test suite green.
						emailVerified: new Date(),
					});
					userId = created.userId;
				} catch (err) {
					const isHandleRace =
						typeof err === "object" && err !== null && "code" in err &&
						(err as { code?: string }).code === "P2002";
					if (isHandleRace && chosenHandle) return badRequest("That handle is already taken.");
					if (isHandleRace && attempt < MAX_HANDLE_ATTEMPTS - 1) continue;
					throw err;
				}
			}
			responseUserId = userId!;
			logAction("user.signup.dev_bypass", responseUserId);
		} else {
			let result: ConsumeInviteResult | null = null;
			for (let attempt = 0; attempt < MAX_HANDLE_ATTEMPTS; attempt++) {
				const handle = chosenHandle ?? await generateUniqueHandle(normalizedEmail);
				result = await consumeInviteAndCreateUser({
					normalizedEmail,
					handle,
					passwordHash,
					rawInviteToken: inviteStr,
					displayName,
				});
				// Retry only the handle race; any other failure (bad invite, email taken) is final.
				if (result.ok || !result.handleConflict) break;
			}

			if (!result || !result.ok) {
				return badRequest(result?.error ?? "Failed to create account");
			}

			responseUserId = result.userId;
			logAction("user.signup", responseUserId);

			// Real (invite) signup: issue a verification token and email it AFTER
			// responding. Moved off the response path so a token/email failure can't
			// turn a successfully-created account into a 500 — the user can always
			// resend from the check-inbox / login pages.
			const newUserId = responseUserId;
			after(async () => {
				try {
					const { rawToken } = await createEmailVerificationToken(newUserId);
					await sendVerificationEmail(
						normalizedEmail,
						absoluteUrl(VERIFY_EMAIL_WITH_TOKEN(rawToken)),
					);
				} catch (err) {
					logAction("user.signup.verification_email_failed", newUserId, {
						error: err instanceof Error ? err.message : String(err),
					});
				}
			});
		}

		// Page invites sent to this address before the account existed land in notifications now.
		// Never fails the signup — the account is already created.
		try {
			await claimPageEmailInvites(responseUserId, normalizedEmail);
		} catch (err) {
			logAction("user.signup.claim_page_invites_failed", responseUserId, {
				error: err instanceof Error ? err.message : String(err),
			});
		}

		return NextResponse.json(
			{
				id: responseUserId,
				email: normalizedEmail,
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("POST /api/auth/signup error:", error);
		return serverError("Failed to create account");
	}
}
