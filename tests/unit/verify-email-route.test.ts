/**
 * Route tests for POST /api/auth/verify-email. The token is consumed only on
 * this deliberate POST (never on GET page-load), so email link scanners can't
 * burn the one-time token before the user clicks.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/rate-limit", () => ({
	enforceRateLimit: vi.fn(async () => null),
}));
vi.mock("@/lib/utils/server/auth-tokens", () => ({
	consumeEmailVerificationToken: vi.fn(),
}));
vi.mock("@/lib/utils/errors", () => ({
	badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
}));

import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { consumeEmailVerificationToken } from "@/lib/utils/server/auth-tokens";

const post = (body: unknown) =>
	new Request("http://localhost/api/auth/verify-email", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/verify-email", () => {
	test("valid token → 200 and consumes it", async () => {
		vi.mocked(consumeEmailVerificationToken).mockResolvedValue({ ok: true, userId: "user-1" });
		const res = await verifyEmail(post({ token: "a".repeat(32) }));
		expect(res.status).toBe(200);
		expect(consumeEmailVerificationToken).toHaveBeenCalledWith("a".repeat(32));
	});

	test("malformed token → 400 before touching the token store", async () => {
		const res = await verifyEmail(post({ token: "short" }));
		expect(res.status).toBe(400);
		expect(consumeEmailVerificationToken).not.toHaveBeenCalled();
	});

	test("invalid / expired / already-used token → 400", async () => {
		vi.mocked(consumeEmailVerificationToken).mockResolvedValue({ ok: false, error: "invalid" });
		const res = await verifyEmail(post({ token: "a".repeat(32) }));
		expect(res.status).toBe(400);
	});
});
