/**
 * Unit tests for the email-verification / password-reset token util.
 *
 * Prisma is mocked: $transaction(callback) runs the callback against a mock tx,
 * and $transaction([...]) resolves the array — so we exercise the validation
 * logic (expired / used / missing) without a database.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

// vi.hoisted so the (hoisted) vi.mock factory below can reference `tx`.
const { tx } = vi.hoisted(() => ({
	tx: {
		emailVerificationToken: {
			findUnique: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
			create: vi.fn(),
		},
		passwordResetToken: {
			findUnique: vi.fn(),
			update: vi.fn(),
			deleteMany: vi.fn(),
			create: vi.fn(),
		},
		user: { update: vi.fn() },
	},
}));

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		...tx,
		$transaction: vi.fn((arg: unknown) =>
			Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => unknown)(tx),
		),
	},
}));

import {
	hashToken,
	consumeEmailVerificationToken,
	consumePasswordResetToken,
} from "@/lib/utils/server/auth-tokens";

beforeEach(() => vi.clearAllMocks());

describe("hashToken", () => {
	test("is deterministic and never returns the raw token", () => {
		const raw = "super-secret-raw-token-value";
		const h = hashToken(raw);
		expect(h).toBe(hashToken(raw)); // deterministic
		expect(h).not.toBe(raw); // hashed, not stored raw
		expect(h).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
	});

	test("different inputs hash differently", () => {
		expect(hashToken("a")).not.toBe(hashToken("b"));
	});
});

describe("consumeEmailVerificationToken", () => {
	test("happy path: marks token used + user verified", async () => {
		tx.emailVerificationToken.findUnique.mockResolvedValue({
			id: "tok-1",
			userId: "user-1",
			usedAt: null,
			expiresAt: new Date(Date.now() + 60_000),
		});

		const result = await consumeEmailVerificationToken("rawtoken");

		expect(result).toEqual({ ok: true, userId: "user-1" });
		expect(tx.emailVerificationToken.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "tok-1" } }),
		);
		expect(tx.user.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "user-1" } }),
		);
	});

	test("rejects a missing token", async () => {
		tx.emailVerificationToken.findUnique.mockResolvedValue(null);
		const result = await consumeEmailVerificationToken("rawtoken");
		expect(result.ok).toBe(false);
		expect(tx.user.update).not.toHaveBeenCalled();
	});

	test("rejects an already-used token", async () => {
		tx.emailVerificationToken.findUnique.mockResolvedValue({
			id: "tok-1",
			userId: "user-1",
			usedAt: new Date(),
			expiresAt: new Date(Date.now() + 60_000),
		});
		const result = await consumeEmailVerificationToken("rawtoken");
		expect(result.ok).toBe(false);
		expect(tx.user.update).not.toHaveBeenCalled();
	});

	test("rejects an expired token", async () => {
		tx.emailVerificationToken.findUnique.mockResolvedValue({
			id: "tok-1",
			userId: "user-1",
			usedAt: null,
			expiresAt: new Date(Date.now() - 60_000),
		});
		const result = await consumeEmailVerificationToken("rawtoken");
		expect(result.ok).toBe(false);
		expect(tx.user.update).not.toHaveBeenCalled();
	});
});

describe("consumePasswordResetToken", () => {
	test("happy path: marks token used, returns userId (no password change here)", async () => {
		tx.passwordResetToken.findUnique.mockResolvedValue({
			id: "tok-1",
			userId: "user-1",
			usedAt: null,
			expiresAt: new Date(Date.now() + 60_000),
		});

		const result = await consumePasswordResetToken("rawtoken");

		expect(result).toEqual({ ok: true, userId: "user-1" });
		expect(tx.passwordResetToken.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "tok-1" } }),
		);
		// This util must not touch the user's password.
		expect(tx.user.update).not.toHaveBeenCalled();
	});

	test("rejects an expired token", async () => {
		tx.passwordResetToken.findUnique.mockResolvedValue({
			id: "tok-1",
			userId: "user-1",
			usedAt: null,
			expiresAt: new Date(Date.now() - 1),
		});
		const result = await consumePasswordResetToken("rawtoken");
		expect(result.ok).toBe(false);
		expect(tx.passwordResetToken.update).not.toHaveBeenCalled();
	});
});
