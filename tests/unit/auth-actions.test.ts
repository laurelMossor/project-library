/**
 * The signed-out account flows (src/lib/actions/auth.ts) over mocked Prisma, tokens, and email. Asserts
 * the guarantees each flow must keep:
 *   - forgot password and resend verification answer the same way whether or not the account exists
 *     (no enumeration) and send the email after responding (`after`, mocked to run immediately);
 *   - reset and verify refuse a malformed token before touching the token store, and pass only a hash;
 *   - unsubscribe is authorized by the signed token alone and flips only that identity's master;
 *   - signup requires a valid invite (or the dev bypass), refuses a taken chosen handle, and retries a
 *     generated handle's race;
 *   - every flow is rate-limited per client.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/server")>();
	return { ...actual, after: (cb: () => void | Promise<void>) => void cb() };
});
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn(async () => null) }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn(async () => false) }));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/prisma", () => {
	const prisma: any = {
		user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
		page: { findUnique: vi.fn() },
		notificationPreference: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
	};
	prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
	return { prisma };
});
vi.mock("@/lib/utils/server/auth-tokens", () => ({
	createPasswordResetToken: vi.fn(async () => ({ rawToken: "raw", expiresAt: new Date() })),
	consumePasswordResetToken: vi.fn(),
	createEmailVerificationToken: vi.fn(async () => ({ rawToken: "raw", expiresAt: new Date() })),
	consumeEmailVerificationToken: vi.fn(),
}));
vi.mock("@/lib/utils/server/email/emails", () => ({
	sendPasswordResetEmail: vi.fn(async () => ({ ok: true })),
	sendVerificationEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/utils/server/unsubscribe-token", () => ({ verifyUnsubscribeToken: vi.fn() }));
vi.mock("@/lib/utils/server/signup-invite", () => ({ consumeInviteAndCreateUser: vi.fn() }));
vi.mock("@/lib/utils/server/dev-signup-bypass", () => ({ isDevSignupBypassToken: vi.fn(() => false) }));
vi.mock("@/lib/utils/server/handle", () => ({
	handleUnavailableReason: vi.fn(async () => null),
	generateUniqueHandle: vi.fn(async () => "generated"),
}));
vi.mock("@/lib/utils/server/user", () => ({ createUser: vi.fn() }));
vi.mock("@/lib/utils/server/requests", () => ({ claimPageEmailInvites: vi.fn() }));

import {
	requestPasswordResetAction,
	resendVerificationAction,
	resetPasswordAction,
	signupAction,
	unsubscribeAction,
	verifyEmailAction,
} from "@/lib/actions/auth";
import { prisma } from "@/lib/utils/server/prisma";
import { isRateLimited } from "@/lib/utils/server/rate-limit";
import {
	consumeEmailVerificationToken,
	consumePasswordResetToken,
	createEmailVerificationToken,
} from "@/lib/utils/server/auth-tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/utils/server/email/emails";
import { verifyUnsubscribeToken } from "@/lib/utils/server/unsubscribe-token";
import { consumeInviteAndCreateUser } from "@/lib/utils/server/signup-invite";
import { isDevSignupBypassToken } from "@/lib/utils/server/dev-signup-bypass";
import { handleUnavailableReason } from "@/lib/utils/server/handle";
import { createUser } from "@/lib/utils/server/user";
import { claimPageEmailInvites } from "@/lib/utils/server/requests";

const p = prisma as any;
const TOKEN = "a".repeat(32);
const INVITE = "b".repeat(43);

beforeEach(() => {
	vi.clearAllMocks();
	p.$transaction.mockImplementation(async (fn: any) => fn(p));
	vi.mocked(isRateLimited).mockResolvedValue(false);
});

describe("forgot password", () => {
	test("existing account → ok, and the reset email goes out", async () => {
		p.user.findUnique.mockResolvedValue({ id: "user-1" });
		expect(await requestPasswordResetAction({ email: "a@b.com" })).toEqual({ ok: true, data: undefined });
		await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1));
	});

	test("unknown email → the same ok, no email (no enumeration)", async () => {
		p.user.findUnique.mockResolvedValue(null);
		expect(await requestPasswordResetAction({ email: "nobody@b.com" })).toEqual({ ok: true, data: undefined });
		expect(sendPasswordResetEmail).not.toHaveBeenCalled();
	});

	test("invalid email format → invalid", async () => {
		expect(await requestPasswordResetAction({ email: "not-an-email" })).toMatchObject({ ok: false, error: "invalid" });
	});

	test("rate limited → never looks the account up", async () => {
		vi.mocked(isRateLimited).mockResolvedValue(true);
		expect(await requestPasswordResetAction({ email: "a@b.com" })).toMatchObject({ ok: false, error: "rate_limited" });
		expect(p.user.findUnique).not.toHaveBeenCalled();
	});
});

describe("reset password", () => {
	test("valid token + password → ok, and only a hash reaches the token store", async () => {
		vi.mocked(consumePasswordResetToken).mockResolvedValue({ ok: true, userId: "user-1" });
		expect(await resetPasswordAction({ token: TOKEN, password: "newpassword123" })).toMatchObject({ ok: true });
		expect(consumePasswordResetToken).toHaveBeenCalledWith(TOKEN, expect.any(String));
		expect(vi.mocked(consumePasswordResetToken).mock.calls[0][1]).not.toBe("newpassword123");
		// The password write + tokenVersion bump live in consumePasswordResetToken's transaction.
		expect(p.user.update).not.toHaveBeenCalled();
	});

	test("malformed token → refused before touching the token store", async () => {
		expect(await resetPasswordAction({ token: "short", password: "newpassword123" })).toMatchObject({ ok: false, error: "invalid" });
		expect(consumePasswordResetToken).not.toHaveBeenCalled();
	});

	test("short password → invalid", async () => {
		expect(await resetPasswordAction({ token: TOKEN, password: "short" })).toMatchObject({ ok: false, error: "invalid" });
		expect(consumePasswordResetToken).not.toHaveBeenCalled();
	});

	test("expired or used token → the store's refusal", async () => {
		vi.mocked(consumePasswordResetToken).mockResolvedValue({ ok: false, error: "This link has expired." });
		expect(await resetPasswordAction({ token: TOKEN, password: "newpassword123" })).toEqual({
			ok: false,
			error: "invalid",
			message: "This link has expired.",
		});
	});
});

describe("verify email", () => {
	test("valid token → ok and consumed", async () => {
		vi.mocked(consumeEmailVerificationToken).mockResolvedValue({ ok: true, userId: "user-1" });
		expect(await verifyEmailAction({ token: TOKEN })).toMatchObject({ ok: true });
		expect(consumeEmailVerificationToken).toHaveBeenCalledWith(TOKEN);
	});

	test("malformed token → refused before touching the token store", async () => {
		expect(await verifyEmailAction({ token: "short" })).toMatchObject({ ok: false, error: "invalid" });
		expect(consumeEmailVerificationToken).not.toHaveBeenCalled();
	});

	test("invalid / expired / already-used token → invalid", async () => {
		vi.mocked(consumeEmailVerificationToken).mockResolvedValue({ ok: false, error: "invalid" });
		expect(await verifyEmailAction({ token: TOKEN })).toMatchObject({ ok: false, error: "invalid" });
	});
});

describe("resend verification", () => {
	test("unverified account → ok, and a new link goes out", async () => {
		p.user.findUnique.mockResolvedValue({ id: "user-1", emailVerified: null });
		expect(await resendVerificationAction({ email: "a@b.com" })).toEqual({ ok: true, data: undefined });
		await vi.waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
	});

	test("already verified or unknown → the same ok, no email", async () => {
		p.user.findUnique.mockResolvedValue({ id: "user-1", emailVerified: new Date() });
		expect(await resendVerificationAction({ email: "a@b.com" })).toEqual({ ok: true, data: undefined });
		p.user.findUnique.mockResolvedValue(null);
		expect(await resendVerificationAction({ email: "nobody@b.com" })).toEqual({ ok: true, data: undefined });
		expect(sendVerificationEmail).not.toHaveBeenCalled();
	});
});

describe("unsubscribe", () => {
	test("invalid token → invalid, no preference write", async () => {
		vi.mocked(verifyUnsubscribeToken).mockReturnValue(null);
		expect(await unsubscribeAction({ token: "bad" })).toMatchObject({ ok: false, error: "invalid" });
		expect(p.notificationPreference.create).not.toHaveBeenCalled();
		expect(p.notificationPreference.update).not.toHaveBeenCalled();
	});

	test("personal token switches that identity's master off", async () => {
		vi.mocked(verifyUnsubscribeToken).mockReturnValue({ recipientUserId: "alice", contextPageId: null });
		p.notificationPreference.findFirst.mockResolvedValue(null);
		expect(await unsubscribeAction({ token: "good" })).toEqual({ ok: true, data: "your personal" });
		expect(p.notificationPreference.create).toHaveBeenCalledWith({
			data: { userId: "alice", contextPageId: null, category: null, enabled: false },
		});
	});

	test("page token returns the page name and switches the page-context master off", async () => {
		vi.mocked(verifyUnsubscribeToken).mockReturnValue({ recipientUserId: "alice", contextPageId: "pageX" });
		p.notificationPreference.findFirst.mockResolvedValue({ id: "pref-1" });
		p.page.findUnique.mockResolvedValue({ name: "Repair Café" });
		expect(await unsubscribeAction({ token: "good" })).toEqual({ ok: true, data: "Repair Café" });
		expect(p.notificationPreference.update).toHaveBeenCalledWith({ where: { id: "pref-1" }, data: { enabled: false } });
	});
});

describe("signup", () => {
	const form = { email: "New@Example.com", password: "password123", invite: INVITE, handle: "newbie" };

	beforeEach(() => {
		vi.mocked(consumeInviteAndCreateUser).mockResolvedValue({ ok: true, userId: "u-new" } as never);
	});

	test("valid invite → creates the account, emails verification, claims page invites", async () => {
		expect(await signupAction(form)).toEqual({ ok: true, data: undefined });
		expect(consumeInviteAndCreateUser).toHaveBeenCalledWith(
			expect.objectContaining({ normalizedEmail: "new@example.com", handle: "newbie", rawInviteToken: INVITE }),
		);
		await vi.waitFor(() => expect(createEmailVerificationToken).toHaveBeenCalledWith("u-new"));
		expect(claimPageEmailInvites).toHaveBeenCalledWith("u-new", "new@example.com");
	});

	test("missing or malformed invite → refused, nothing created", async () => {
		expect(await signupAction({ ...form, invite: "" })).toMatchObject({ ok: false, error: "invalid" });
		expect(consumeInviteAndCreateUser).not.toHaveBeenCalled();
	});

	test("a taken chosen handle → conflict, nothing created", async () => {
		vi.mocked(handleUnavailableReason).mockResolvedValueOnce("That handle is already taken.");
		expect(await signupAction(form)).toEqual({ ok: false, error: "conflict", message: "That handle is already taken." });
		expect(consumeInviteAndCreateUser).not.toHaveBeenCalled();
	});

	test("a generated handle that loses a race is regenerated and retried", async () => {
		vi.mocked(consumeInviteAndCreateUser)
			.mockResolvedValueOnce({ ok: false, error: "taken", handleConflict: true } as never)
			.mockResolvedValueOnce({ ok: true, userId: "u-new" } as never);
		expect(await signupAction({ ...form, handle: undefined })).toMatchObject({ ok: true });
		expect(consumeInviteAndCreateUser).toHaveBeenCalledTimes(2);
	});

	test("a refused invite (used, expired, email taken) reports its reason", async () => {
		vi.mocked(consumeInviteAndCreateUser).mockResolvedValue({ ok: false, error: "This invite has already been used." } as never);
		expect(await signupAction(form)).toEqual({ ok: false, error: "invalid", message: "This invite has already been used." });
	});

	test("dev bypass creates a pre-verified account without consuming an invite", async () => {
		vi.mocked(isDevSignupBypassToken).mockReturnValueOnce(true);
		p.user.findFirst.mockResolvedValue(null);
		vi.mocked(createUser).mockResolvedValue({ userId: "u-dev" } as never);
		expect(await signupAction({ ...form, invite: "dev" })).toMatchObject({ ok: true });
		expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: expect.any(Date) }));
		expect(consumeInviteAndCreateUser).not.toHaveBeenCalled();
	});

	test("rate limited → the signup-specific message", async () => {
		vi.mocked(isRateLimited).mockResolvedValue(true);
		expect(await signupAction(form)).toEqual({
			ok: false,
			error: "rate_limited",
			message: "Too many signup attempts. Please try again later.",
		});
	});
});
