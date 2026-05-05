import { describe, test, expect } from "vitest";
import { RESERVED_HANDLES, isReservedHandle } from "@/lib/const/reserved-handles";

describe("isReservedHandle", () => {
	test("rejects existing top-level route names", () => {
		expect(isReservedHandle("api")).toBe(true);
		expect(isReservedHandle("explore")).toBe(true);
		expect(isReservedHandle("messages")).toBe(true);
		expect(isReservedHandle("login")).toBe(true);
		expect(isReservedHandle("signup")).toBe(true);
	});

	test("rejects single-letter handles a–z (covers former /u and /p prefixes)", () => {
		for (const c of "abcdefghijklmnopqrstuvwxyz") {
			expect(isReservedHandle(c)).toBe(true);
		}
	});

	test("rejects auth/verification flow names", () => {
		expect(isReservedHandle("auth")).toBe(true);
		expect(isReservedHandle("oauth")).toBe(true);
		expect(isReservedHandle("verify")).toBe(true);
	});

	test("rejects infrastructure / static path names", () => {
		expect(isReservedHandle("www")).toBe(true);
		expect(isReservedHandle("cdn")).toBe(true);
		expect(isReservedHandle("static")).toBe(true);
		expect(isReservedHandle("_next")).toBe(true);
	});

	test("rejects vanity / admin names", () => {
		expect(isReservedHandle("admin")).toBe(true);
		expect(isReservedHandle("me")).toBe(true);
	});

	test("rejects anti-impersonation names", () => {
		expect(isReservedHandle("projectlibrary")).toBe(true);
		expect(isReservedHandle("official")).toBe(true);
		expect(isReservedHandle("staff")).toBe(true);
	});

	test("is case-insensitive (lowercases input before lookup)", () => {
		expect(isReservedHandle("API")).toBe(true);
		expect(isReservedHandle("Explore")).toBe(true);
		expect(isReservedHandle("ProjectLibrary")).toBe(true);
	});

	test("accepts ordinary handles that are not in the reserved set", () => {
		expect(isReservedHandle("laurel")).toBe(false);
		expect(isReservedHandle("spats-improv")).toBe(false);
		expect(isReservedHandle("portland-makers")).toBe(false);
		expect(isReservedHandle("user_123")).toBe(false);
	});

	test("RESERVED_HANDLES is a populated Set", () => {
		expect(RESERVED_HANDLES).toBeInstanceOf(Set);
		// Sanity bound: enough that we know the file wasn't accidentally emptied,
		// loose enough that adding/removing entries doesn't break tests.
		expect(RESERVED_HANDLES.size).toBeGreaterThan(40);
	});
});
