/**
 * Unit tests for the shared /api/me/* save core (whitelist + validation) that
 * both profile routes delegate to. Guards the two regressions this change fixes:
 *  - page `visibility` used to be silently dropped → now whitelisted + validated
 *  - the user avatar field used to be lost to a flat payload → now in the set
 * and the mass-assignment guard (updatePageProfile copies every provided key).
 *
 * Prisma + session are mocked so no DB/auth is required.
 */
import { describe, test, expect, vi } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { pickProfileFields, validateProfileFields } from "@/lib/utils/server/profile-update";

describe("pickProfileFields", () => {
	test("PAGE keeps visibility (regression: was silently dropped)", () => {
		expect(pickProfileFields("PAGE", { name: "X", visibility: "PRIVATE" })).toEqual({
			name: "X",
			visibility: "PRIVATE",
		});
	});

	test("PAGE drops unknown keys (mass-assignment guard)", () => {
		expect(
			pickProfileFields("PAGE", { name: "X", handle: "hacked", createdByUserId: "u9", visibility: "PUBLIC" })
		).toEqual({ name: "X", visibility: "PUBLIC" });
	});

	test("USER keeps avatarImageId (regression: flat payload lost it)", () => {
		expect(pickProfileFields("USER", { avatarImageId: "img-1" })).toEqual({ avatarImageId: "img-1" });
	});

	test("USER keeps visibility, drops unknown keys", () => {
		expect(pickProfileFields("USER", { displayName: "Al", visibility: "UNLISTED", role: "ADMIN" })).toEqual({
			displayName: "Al",
			visibility: "UNLISTED",
		});
	});

	test("undefined values are omitted", () => {
		expect(pickProfileFields("USER", { displayName: undefined, bio: "hi" })).toEqual({ bio: "hi" });
	});
});

describe("validateProfileFields", () => {
	test("PAGE accepts a valid visibility", () => {
		expect(validateProfileFields("PAGE", { visibility: "PRIVATE" })).toBeNull();
	});

	test("PAGE rejects an invalid visibility", () => {
		expect(validateProfileFields("PAGE", { visibility: "SECRET" })).toMatch(/visibility/i);
	});

	test("USER rejects an invalid visibility", () => {
		expect(validateProfileFields("USER", { visibility: "SECRET" })).toMatch(/visibility/i);
	});

	test("PAGE rejects an empty name", () => {
		expect(validateProfileFields("PAGE", { name: "   " })).toMatch(/name/i);
	});

	test("empty field sets pass for both kinds", () => {
		expect(validateProfileFields("USER", {})).toBeNull();
		expect(validateProfileFields("PAGE", {})).toBeNull();
	});
});
