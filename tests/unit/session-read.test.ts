import { describe, test, expect } from "vitest";
import { sessionReadConfirmsLogout } from "@/lib/utils/auth-client";

describe("sessionReadConfirmsLogout", () => {
	test("a user id is a live login", () => {
		expect(sessionReadConfirmsLogout(true, { user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" })).toBe(false);
	});

	test("expires-only body is a confirmed logout", () => {
		expect(sessionReadConfirmsLogout(true, { expires: "2099-01-01T00:00:00.000Z" })).toBe(true);
	});

	test("null body (no cookie) is a confirmed logout", () => {
		expect(sessionReadConfirmsLogout(true, null)).toBe(true);
	});

	test("a failed read is not a logout", () => {
		expect(sessionReadConfirmsLogout(false, null)).toBe(false);
		expect(sessionReadConfirmsLogout(false, { expires: "2099-01-01T00:00:00.000Z" })).toBe(false);
	});
});
