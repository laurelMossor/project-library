import { describe, test, expect } from "vitest";
import { safeNext } from "@/lib/utils/safe-next";

const fallback = "/explore";

describe("safeNext", () => {
	test("keeps an in-app path, including its query string", () => {
		expect(safeNext("/settings?tab=profile", fallback)).toBe("/settings?tab=profile");
		expect(safeNext("/pages/new", fallback)).toBe("/pages/new");
		// The login callback from a profile's "+ Create" keeps its target collection.
		expect(safeNext("/events/new?to=cmvd1qcph000dqcuoiw1lglxz", fallback)).toBe("/events/new?to=cmvd1qcph000dqcuoiw1lglxz");
	});

	test("rejects script and other non-path schemes", () => {
		expect(safeNext("javascript:alert(1)", fallback)).toBe(fallback);
		expect(safeNext("data:text/html,hi", fallback)).toBe(fallback);
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
