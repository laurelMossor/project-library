/**
 * Route tests for the password-reset / forgot-password endpoints. Dependencies
 * (prisma, token util, email, rate-limit) are mocked — we assert HTTP behavior,
 * especially the no-account-enumeration guarantee on forgot-password.
 *
 * forgot-password dispatches its email via next/server `after()` (off the
 * response path, so response timing doesn't leak account existence); we mock
 * `after` to invoke the callback so the send is observable here.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/server")>();
	return { ...actual, after: (cb: () => void | Promise<void>) => void cb() };
});
vi.mock("@/lib/utils/server/rate-limit", () => ({
	enforceRateLimit: vi.fn(async () => null),
}));
vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/utils/server/auth-tokens", () => ({
	createPasswordResetToken: vi.fn(async () => ({ rawToken: "raw", expiresAt: new Date() })),
	consumePasswordResetToken: vi.fn(),
}));
vi.mock("@/lib/utils/server/email/emails", () => ({
	sendPasswordResetEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/utils/errors", () => ({
	badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
	serverError: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 500 }),
}));

import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { prisma } from "@/lib/utils/server/prisma";
import { sendPasswordResetEmail } from "@/lib/utils/server/email/emails";
import { consumePasswordResetToken } from "@/lib/utils/server/auth-tokens";

const post = (url: string, body: unknown) =>
	new Request(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/forgot-password", () => {
	test("existing account → 200 and sends the email (after response)", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
		const res = await forgotPassword(post("http://localhost/api/auth/forgot-password", { email: "a@b.com" }));
		expect(res.status).toBe(200);
		await vi.waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1));
	});

	test("unknown email → still 200, no email sent (no enumeration)", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
		const res = await forgotPassword(post("http://localhost/api/auth/forgot-password", { email: "nobody@b.com" }));
		expect(res.status).toBe(200);
		expect(sendPasswordResetEmail).not.toHaveBeenCalled();
	});

	test("invalid email format → 400", async () => {
		const res = await forgotPassword(post("http://localhost/api/auth/forgot-password", { email: "not-an-email" }));
		expect(res.status).toBe(400);
	});
});

describe("POST /api/auth/reset-password", () => {
	test("valid token + password → 200, consumes token with the new hash (atomic write)", async () => {
		vi.mocked(consumePasswordResetToken).mockResolvedValue({ ok: true, userId: "user-1" });
		const res = await resetPassword(
			post("http://localhost/api/auth/reset-password", {
				token: "a".repeat(32),
				password: "newpassword123",
			}),
		);
		expect(res.status).toBe(200);
		// The password write + tokenVersion bump now happen inside consumePasswordResetToken's
		// transaction; the route hashes first and passes the hash in (never the raw password).
		expect(consumePasswordResetToken).toHaveBeenCalledWith("a".repeat(32), expect.any(String));
		const passedHash = vi.mocked(consumePasswordResetToken).mock.calls[0][1];
		expect(passedHash).not.toBe("newpassword123");
		// The route no longer writes the user directly — the util owns that write.
		expect(prisma.user.update).not.toHaveBeenCalled();
	});

	test("malformed token → 400 before touching the DB", async () => {
		const res = await resetPassword(
			post("http://localhost/api/auth/reset-password", { token: "short", password: "newpassword123" }),
		);
		expect(res.status).toBe(400);
		expect(consumePasswordResetToken).not.toHaveBeenCalled();
	});

	test("short password → 400", async () => {
		const res = await resetPassword(
			post("http://localhost/api/auth/reset-password", { token: "a".repeat(32), password: "short" }),
		);
		expect(res.status).toBe(400);
	});

	test("invalid/expired token → 400", async () => {
		vi.mocked(consumePasswordResetToken).mockResolvedValue({ ok: false, error: "expired" });
		const res = await resetPassword(
			post("http://localhost/api/auth/reset-password", {
				token: "a".repeat(32),
				password: "newpassword123",
			}),
		);
		expect(res.status).toBe(400);
		expect(prisma.user.update).not.toHaveBeenCalled();
	});
});
