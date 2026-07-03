/**
 * Unit tests for the shared /api/me/* save core (whitelist + validation) that
 * both profile routes delegate to. Guards:
 *  - page profileVisibility/contentVisibility are whitelisted + validated (not dropped)
 *  - the user avatar field survives the payload
 *  - the mass-assignment guard drops unknown keys (updatePageProfile copies every provided key)
 *
 * Prisma + session are mocked so no DB/auth is required.
 */
import { describe, test, expect, vi } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { pickProfileFields, validateProfileFields } from "@/lib/utils/server/profile-update";

describe("pickProfileFields", () => {
	test("PAGE keeps profileVisibility + contentVisibility", () => {
		expect(
			pickProfileFields("PAGE", { name: "X", profileVisibility: "PRIVATE", contentVisibility: "PRIVATE" })
		).toEqual({ name: "X", profileVisibility: "PRIVATE", contentVisibility: "PRIVATE" });
	});

	test("PAGE drops unknown keys (mass-assignment guard) — incl. the removed `visibility`", () => {
		expect(
			pickProfileFields("PAGE", {
				name: "X",
				handle: "hacked",
				createdByUserId: "u9",
				visibility: "PUBLIC",
				profileVisibility: "PUBLIC",
			})
		).toEqual({ name: "X", profileVisibility: "PUBLIC" });
	});

	test("USER keeps avatarImageId (regression: flat payload lost it)", () => {
		expect(pickProfileFields("USER", { avatarImageId: "img-1" })).toEqual({ avatarImageId: "img-1" });
	});

	test("USER keeps profileVisibility + contentVisibility, drops unknown keys", () => {
		expect(
			pickProfileFields("USER", { displayName: "Al", contentVisibility: "UNLISTED", role: "ADMIN" })
		).toEqual({ displayName: "Al", contentVisibility: "UNLISTED" });
	});

	test("undefined values are omitted", () => {
		expect(pickProfileFields("USER", { displayName: undefined, bio: "hi" })).toEqual({ bio: "hi" });
	});
});

describe("validateProfileFields", () => {
	test("PAGE accepts valid profileVisibility + contentVisibility", () => {
		expect(validateProfileFields("PAGE", { profileVisibility: "PRIVATE", contentVisibility: "UNLISTED" })).toBeNull();
	});

	test("PAGE rejects an invalid profileVisibility", () => {
		expect(validateProfileFields("PAGE", { profileVisibility: "SECRET" })).toMatch(/profileVisibility/i);
	});

	test("USER rejects an invalid contentVisibility", () => {
		expect(validateProfileFields("USER", { contentVisibility: "SECRET" })).toMatch(/contentVisibility/i);
	});

	test("PAGE rejects an empty name", () => {
		expect(validateProfileFields("PAGE", { name: "   " })).toMatch(/name/i);
	});

	test("empty field sets pass for both kinds", () => {
		expect(validateProfileFields("USER", {})).toBeNull();
		expect(validateProfileFields("PAGE", {})).toBeNull();
	});
});
