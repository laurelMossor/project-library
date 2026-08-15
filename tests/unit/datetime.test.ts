import { describe, test, expect } from "vitest";
import { formatDateTime, formatInstantAbsolute } from "@/lib/utils/datetime";

describe("formatDateTime", () => {
	test("formats in the given timezone regardless of process TZ", () => {
		const date = new Date("2026-08-10T19:00:00.000Z");
		const la = formatDateTime(date, "America/Los_Angeles");
		const ny = formatDateTime(date, "America/New_York");
		expect(la).toMatch(/Aug 10, 2026/);
		expect(la).toMatch(/PDT|PST/);
		expect(ny).toMatch(/Aug 10, 2026/);
		expect(ny).toMatch(/EDT|EST/);
	});

	test("is stable under different process TZ env", () => {
		const date = new Date("2026-01-15T12:00:00.000Z");
		const tz = "UTC";
		const before = formatDateTime(date, tz);
		const prev = process.env.TZ;
		process.env.TZ = "Pacific/Auckland";
		const after = formatDateTime(date, tz);
		if (prev === undefined) delete process.env.TZ;
		else process.env.TZ = prev;
		expect(after).toBe(before);
		expect(before).toMatch(/Jan 15, 2026/);
	});
});

describe("formatInstantAbsolute", () => {
	test("produces MMM D, YYYY at H:MM AM/PM in local time", () => {
		const date = new Date("2026-08-10T12:00:00.000Z");
		expect(formatInstantAbsolute(date)).toMatch(/Aug 10, 2026 at \d{1,2}:\d{2} (AM|PM)/);
	});
});
