/**
 * Unit tests for the stateless unsubscribe token (unsubscribe-token.ts). A round-trips to itself; a
 * tampered payload or signature is rejected; verifying is pure (no state), so a scanner prefetch that
 * only verifies changes nothing.
 */
import { describe, test, expect } from "vitest";

// The module reads its secret at import time, so set it BEFORE the dynamic import below.
process.env.UNSUBSCRIBE_SECRET = "test-unsub-secret";
const { signUnsubscribeToken, verifyUnsubscribeToken } = await import("@/lib/utils/server/unsubscribe-token");

describe("unsubscribe token", () => {
	test("round-trips a personal identity", () => {
		const token = signUnsubscribeToken({ recipientUserId: "alice", contextPageId: null });
		expect(verifyUnsubscribeToken(token)).toEqual({ recipientUserId: "alice", contextPageId: null });
	});

	test("round-trips a page-context identity", () => {
		const token = signUnsubscribeToken({ recipientUserId: "alice", contextPageId: "pageX" });
		expect(verifyUnsubscribeToken(token)).toEqual({ recipientUserId: "alice", contextPageId: "pageX" });
	});

	test("a tampered payload is rejected (signature no longer matches)", () => {
		const token = signUnsubscribeToken({ recipientUserId: "alice", contextPageId: null });
		const [, sig] = token.split(".");
		const forged = `${Buffer.from(JSON.stringify({ u: "mallory", p: null })).toString("base64url")}.${sig}`;
		expect(verifyUnsubscribeToken(forged)).toBeNull();
	});

	test("a garbage token is rejected", () => {
		expect(verifyUnsubscribeToken("not-a-token")).toBeNull();
		expect(verifyUnsubscribeToken("")).toBeNull();
	});

	test("verifying is idempotent — the same token verifies the same way repeatedly (prefetch-safe)", () => {
		const token = signUnsubscribeToken({ recipientUserId: "alice", contextPageId: "pageX" });
		expect(verifyUnsubscribeToken(token)).toEqual(verifyUnsubscribeToken(token));
	});
});
