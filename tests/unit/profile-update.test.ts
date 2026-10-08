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
		image: { findUnique: vi.fn() },
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

	test("allowManageChange=false + a visibility field → blocked (403-class error), no write", async () => {
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { profileVisibility: "PRIVATE" } },
			{ allowManageChange: false },
		);
		expect(res).toEqual({ ok: false, error: expect.stringMatching(/only an admin/i), forbidden: true });
		// Returned before any DB work — the gate is an early-out.
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("allowManageChange=false + only a NON-visibility field → not blocked (gate is visibility-specific)", async () => {
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { name: "New Name" } },
			{ allowManageChange: false },
		);
		expect(res.ok).toBe(true);
	});

	test("allowManageChange=true + a visibility field → passes the gate (admin may change privacy)", async () => {
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { profileVisibility: "PRIVATE", contentVisibility: "PRIVATE" } },
			{ allowManageChange: true },
		);
		expect(res.ok).toBe(true);
	});

	test("OPEN membership is rejected", async () => {
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { membershipPolicy: "OPEN" } },
			{ allowManageChange: true },
		);
		expect(res.ok).toBe(false);
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("saving CLOSED forces member posts off", async () => {
		vi.mocked(prisma.page.findUnique).mockResolvedValue({
			profileVisibility: "PUBLIC",
			contentVisibility: "LISTED",
			membershipPolicy: "REQUEST_TO_JOIN",
			allowMemberPosts: true,
		} as never);
		const res = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { membershipPolicy: "CLOSED" } },
			{ allowManageChange: true },
		);
		expect(res.ok).toBe(true);
		const tx = vi.mocked(prisma.$transaction).mock.calls[0][0] as (db: typeof prisma) => Promise<unknown>;
		const db = {
			page: {
				update: vi.fn().mockResolvedValue({}),
				findUnique: vi.fn().mockResolvedValue({}),
			},
		};
		await tx(db as never);
		expect(db.page.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ membershipPolicy: "CLOSED", allowMemberPosts: false }),
			}),
		);
	});

	test("defaults to allowed (a user editing their own profile is always permitted)", async () => {
		const res = await saveMyProfile("USER", "u1", { fields: { contentVisibility: "UNLISTED" } });
		expect(res.ok).toBe(true);
	});

	test("a page avatar is judged by the session user, not the page id", async () => {
		vi.mocked(prisma.page.findUnique).mockResolvedValue({ avatarImageId: null } as never);
		vi.mocked(prisma.image.findUnique).mockResolvedValue({
			uploadedByUserId: "editor-1",
			_count: { attachments: 0 },
		} as never);

		const ok = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { avatarImageId: "img-new" } },
			{ actorUserId: "editor-1" },
		);
		expect(ok.ok).toBe(true);

		vi.mocked(prisma.image.findUnique).mockResolvedValue({
			uploadedByUserId: "p1",
			_count: { attachments: 0 },
		} as never);
		const rejected = await saveMyProfile(
			"PAGE",
			"p1",
			{ fields: { avatarImageId: "img-new" } },
			{ actorUserId: "editor-1" },
		);
		expect(rejected).toEqual({ ok: false, error: expect.stringMatching(/profile picture/i) });
	});
});
