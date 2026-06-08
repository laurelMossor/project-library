/**
 * Route tests for the password-reset endpoints. Dependencies (prisma, token
 * util, email, rate-limit) are mocked — we assert HTTP behavior, especially
 * the no-account-enumeration guarantee on forgot-password.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/rate-limit", () => ({
	checkRateLimit: vi.fn(() => ({ allowed: true })),
	getClientIdentifier: vi.fn(() => "test-ip"),
}));
vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/utils/server/auth-tokens", () => ({
	createPasswordResetToken: vi.fn(async () => ({ rawToken: "raw", expiresAt: new Date() })),
	consumePasswordResetToken: vi.fn(),
}));
vi.mock("@/lib/email/emails", () => ({
	sendPasswordResetEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/utils/errors", () => ({
	badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
	serverError: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 500 }),
}));

import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { prisma } from "@/lib/utils/server/prisma";
import { sendPasswordResetEmail } from "@/lib/email/emails";
import { consumePasswordResetToken } from "@/lib/utils/server/auth-tokens";

const post = (url: string, body: unknown) =>
	new Request(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/forgot-password", () => {
	test("existing account → 200 and sends the email", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
		const res = await forgotPassword(post("http://localhost/api/auth/forgot-password", { email: "a@b.com" }));
		expect(res.status).toBe(200);
		expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
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
	test("valid token + password → 200 and updates the hash", async () => {
		vi.mocked(consumePasswordResetToken).mockResolvedValue({ ok: true, userId: "user-1" });
		const res = await resetPassword(
			post("http://localhost/api/auth/reset-password", {
				token: "a".repeat(32),
				password: "newpassword123",
			}),
		);
		expect(res.status).toBe(200);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "user-1" } }),
		);
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
