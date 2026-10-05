import { describe, test, expect } from "vitest";
import { safeNext } from "@/lib/utils/safe-next";

const fallback = "/explore";

describe("safeNext", () => {
	test("keeps an in-app path, including its query string", () => {
		expect(safeNext("/settings?tab=profile", fallback)).toBe("/settings?tab=profile");
		expect(safeNext("/pages/new", fallback)).toBe("/pages/new");
	});

	test("rejects off-site and backslash destinations", () => {
		expect(safeNext("//evil.com", fallback)).toBe(fallback);
		expect(safeNext("/\\evil.com", fallback)).toBe(fallback);
		expect(safeNext("https://evil.com", fallback)).toBe(fallback);
		expect(safeNext("/%5cevil.com", fallback)).toBe(fallback);
		expect(safeNext("/%2F/evil.com", fallback)).toBe(fallback);
		expect(safeNext(undefined, fallback)).toBe(fallback);
	});
});
