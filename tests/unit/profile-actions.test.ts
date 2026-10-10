/**
 * Profile and handle saves as Server Actions — the security boundary the old
 * PUT /api/me/user, /api/me/page, /api/pages/[pageId] and /api/me/*handle route tests covered.
 *
 * `profile-update.test.ts` covers the util given an explicit `allowManageChange`; THIS test
 * locks the wiring: that the action feeds `canManagePage` (not `canPostAsPage`) into that flag,
 * and that a refusal comes back as the right ActionResult error code.
 *
 * Design (house style): mock only the real seams — `prisma`, the session, Next's request
 * plumbing — and let the genuine gate run: authedAction → updateProfile → resolveProfileTarget
 * → canPostAsPage / canManagePage → saveMyProfile → whitelist, validation, pairing guard.
 * A user's stored role is modeled through `prisma.permission.findFirst` (both gates query it
 * with a `role: { in: [...] }` set), so nothing about the permission decision is faked.
 * Assertions are behavioral outcomes (result code + whether a write ran).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		permission: { findFirst: vi.fn(), findUnique: vi.fn() },
		page: { findUnique: vi.fn(), update: vi.fn() },
		user: { findUnique: vi.fn(), update: vi.fn() },
		handle: { findUnique: vi.fn(), upsert: vi.fn() },
		$transaction: vi.fn(),
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { saveProfileAction, setHandleAction } from "@/lib/actions/profile";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { isRateLimited } from "@/lib/utils/server/rate-limit";

// Model the caller's stored role on page "p1". `canPostAsPage` asks [ADMIN, EDITOR];
// `canManagePage` asks [ADMIN] — so EDITOR passes the first and fails the second.
function setStoredRole(role: "ADMIN" | "EDITOR" | "MEMBER" | null) {
	vi.mocked(prisma.permission.findFirst).mockImplementation(((args: { where: { role: { in: string[] } } }) => {
		const wanted = args.where.role.in;
		return Promise.resolve(role && wanted.includes(role) ? { role } : null);
	}) as never);
}

const page = { type: "page", id: "p1" } as const;
const user = { type: "user" } as const;
const save = (target: Parameters<typeof saveProfileAction>[0]["target"], fields: Record<string, unknown>) =>
	saveProfileAction({ target, payload: { fields } });

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(isRateLimited).mockResolvedValue(false);
	vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: null } as never);
	// Current state for the PRIVATE+LISTED pairing guard's merge read.
	vi.mocked(prisma.page.findUnique).mockResolvedValue({ profileVisibility: "PUBLIC", contentVisibility: "LISTED" } as never);
	vi.mocked(prisma.user.findUnique).mockResolvedValue({ profileVisibility: "PUBLIC", contentVisibility: "LISTED" } as never);
	// The write seam — resolves the refetched profile so a passing save returns it.
	vi.mocked(prisma.$transaction).mockResolvedValue({ id: "p1", name: "Page" } as never);
});

describe("saveProfileAction — auth & target guards", () => {
	test("signed out → unauthorized, no write", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null as never);
		const res = await save(user, { bio: "x" });
		expect(res).toMatchObject({ ok: false, error: "unauthorized" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("malformed target → invalid, no write", async () => {
		const res = await save({ type: "page" } as never, { bio: "x" });
		expect(res).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("malformed payload → invalid, no write", async () => {
		const res = await saveProfileAction({ target: user, payload: undefined as never });
		expect(res).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("caller has no role on the page → forbidden, no write", async () => {
		setStoredRole(null);
		const res = await save(page, { bio: "x" });
		expect(res).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("a plain MEMBER may not edit the page → forbidden", async () => {
		setStoredRole("MEMBER");
		expect(await save(page, { bio: "x" })).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});

describe("saveProfileAction — user", () => {
	test("saves the signed-in user's own profile and returns it, without any permission read", async () => {
		const res = await save(user, { bio: "An edited bio" });
		expect(res).toEqual({ ok: true, data: { id: "p1", name: "Page" } });
		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
		expect(prisma.permission.findFirst).not.toHaveBeenCalled();
	});

	test("an invalid field is refused, not written", async () => {
		const res = await save(user, { contentVisibility: "SECRET" });
		expect(res).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});

describe("saveProfileAction — page EDITOR (act-as-page, not admin)", () => {
	beforeEach(() => setStoredRole("EDITOR"));

	test("visibility change → forbidden and NO write (the regression lock)", async () => {
		// If the action regressed to feeding canPostAsPage into allowManageChange, the
		// EDITOR would pass and a write would run. forbidden + no-write proves it uses
		// canManagePage (ADMIN-only) for the visibility field.
		const res = await save(page, { profileVisibility: "PRIVATE" });
		expect(res).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("non-visibility field (bio) → saved (gate is visibility-specific)", async () => {
		const res = await save(page, { bio: "An edited bio" });
		expect(res.ok).toBe(true);
		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
	});
});

describe("saveProfileAction — page ADMIN", () => {
	beforeEach(() => setStoredRole("ADMIN"));

	test("visibility change → saved (admin may change privacy)", async () => {
		const res = await save(page, { profileVisibility: "PRIVATE", contentVisibility: "PRIVATE" });
		expect(res.ok).toBe(true);
		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
	});

	test("invalid combo (PRIVATE profile + LISTED content) → invalid, not forbidden, no write", async () => {
		const res = await save(page, { profileVisibility: "PRIVATE", contentVisibility: "LISTED" });
		expect(res).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});

describe("setHandleAction", () => {
	beforeEach(() => {
		vi.mocked(prisma.handle.findUnique).mockResolvedValue(null);
		vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
	});

	test("signed out → unauthorized", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null as never);
		expect(await setHandleAction({ target: user, handle: "newname" })).toMatchObject({ ok: false, error: "unauthorized" });
	});

	test("user: changes their own handle and returns the normalized value", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ handle: "oldname" } as never);
		const res = await setHandleAction({ target: user, handle: "  NewName " });
		expect(res).toEqual({ ok: true, data: "newname" });
		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
	});

	test("page EDITOR may change the page handle", async () => {
		setStoredRole("EDITOR");
		vi.mocked(prisma.page.findUnique).mockResolvedValue({ handle: "oldpage" } as never);
		const res = await setHandleAction({ target: page, handle: "newpage" });
		expect(res).toEqual({ ok: true, data: "newpage" });
	});

	test("no role on the page → forbidden, no write", async () => {
		setStoredRole(null);
		const res = await setHandleAction({ target: page, handle: "newpage" });
		expect(res).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("a taken handle is refused with a message", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ handle: "oldname" } as never);
		vi.mocked(prisma.handle.findUnique).mockResolvedValue({ handle: "taken" } as never);
		const res = await setHandleAction({ target: user, handle: "taken" });
		expect(res).toMatchObject({ ok: false, error: "invalid", message: expect.stringMatching(/taken/i) });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("a malformed handle is refused before any write", async () => {
		const res = await setHandleAction({ target: user, handle: "no" });
		expect(res).toMatchObject({ ok: false, error: "invalid" });
		expect(await setHandleAction({ target: user, handle: 42 as never })).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("rate limited → rate_limited, no write", async () => {
		vi.mocked(isRateLimited).mockResolvedValue(true);
		const res = await setHandleAction({ target: user, handle: "newname" });
		expect(res).toMatchObject({ ok: false, error: "rate_limited" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});
