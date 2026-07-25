/**
 * Unit tests for the shared /api/me/* save core (whitelist + validation) that
 * both profile routes delegate to. Guards:
 *  - page profileVisibility/contentVisibility are whitelisted + validated (not dropped)
 *  - the user avatar field survives the payload
 *  - the mass-assignment guard drops unknown keys (updatePageProfile copies every provided key)
 *
 * Prisma + session are mocked so no DB/auth is required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		page: { findUnique: vi.fn() },
		user: { findUnique: vi.fn() },
		$transaction: vi.fn(),
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { pickProfileFields, validateProfileFields, saveMyProfile } from "@/lib/utils/server/profile-update";
import { prisma } from "@/lib/utils/server/prisma";

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

// ---------------------------------------------------------------------------
// saveMyProfile — the ADMIN-only visibility gate (page privacy is not an EDITOR power)
// ---------------------------------------------------------------------------
describe("saveMyProfile visibility gate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// DB boundary: the pairing guard reads current state, the write runs in a tx.
		vi.mocked(prisma.page.findUnique).mockResolvedValue({ profileVisibility: "PUBLIC", contentVisibility: "LISTED" } as never);
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ profileVisibility: "PUBLIC", contentVisibility: "LISTED" } as never);
		vi.mocked(prisma.$transaction).mockResolvedValue({ id: "p1" } as never);
	});

	test("allowVisibilityChange=false + a visibility field → blocked (403-class error), no write", async () => {
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { profileVisibility: "PRIVATE" } },
			{ allowVisibilityChange: false },
		);
		expect(res).toEqual({ ok: false, error: expect.stringMatching(/only an admin/i), forbidden: true });
		// Returned before any DB work — the gate is an early-out.
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("allowVisibilityChange=false + only a NON-visibility field → not blocked (gate is visibility-specific)", async () => {
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { name: "New Name" } },
			{ allowVisibilityChange: false },
		);
		expect(res.ok).toBe(true);
	});

	test("allowVisibilityChange=true + a visibility field → passes the gate (admin may change privacy)", async () => {
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { profileVisibility: "PRIVATE", contentVisibility: "PRIVATE" } },
			{ allowVisibilityChange: true },
		);
		expect(res.ok).toBe(true);
	});

	test("defaults to allowed (a user editing their own profile is always permitted)", async () => {
		const res = await saveMyProfile("USER", "u1", { fields: { contentVisibility: "UNLISTED" } });
		expect(res.ok).toBe(true);
	});
});
