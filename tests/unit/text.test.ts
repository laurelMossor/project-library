import { describe, test, expect } from "vitest";
import { toTitleCase } from "@/lib/utils/text";

describe("toTitleCase", () => {
	test("capitalizes the first letter of each lowercase word", () => {
		expect(toTitleCase("oil painting")).toBe("Oil Painting");
	});

	test("preserves intentional caps (does not down-case)", () => {
		expect(toTitleCase("DIY")).toBe("DIY");
		expect(toTitleCase("3D printing")).toBe("3D Printing");
	});

	test("leaves a leading digit's word untouched", () => {
		expect(toTitleCase("3d")).toBe("3d");
	});

	test("preserves internal whitespace runs", () => {
		expect(toTitleCase("oil   painting")).toBe("Oil   Painting");
	});

	test("trims surrounding whitespace", () => {
		expect(toTitleCase("  oil painting  ")).toBe("Oil Painting");
	});

	test("empty / whitespace-only input returns empty string", () => {
		expect(toTitleCase("")).toBe("");
		expect(toTitleCase("   ")).toBe("");
	});
});
