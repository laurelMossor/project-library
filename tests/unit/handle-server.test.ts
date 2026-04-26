/**
 * Handle server-utils tests — isHandleTaken, findEntityByHandle
 *
 * Both go through `prisma.handle.findUnique` against the new `handles` table.
 * Prisma is mocked so no DB connection is required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		handle: {
			findUnique: vi.fn(),
		},
	},
}));

import { isHandleTaken, findEntityByHandle } from "@/lib/utils/server/handle";
import { prisma } from "@/lib/utils/server/prisma";

const makeHandleRow = (overrides: Partial<{
	id: string;
	handle: string;
	userId: string | null;
	pageId: string | null;
}> = {}) => ({
	id: overrides.id ?? "handle-1",
	handle: overrides.handle ?? "laurel",
	userId: overrides.userId ?? null,
	pageId: overrides.pageId ?? null,
	createdAt: new Date(),
});

const makeUser = (handle = "laurel") => ({
	id: "user-1",
	email: "u@example.com",
	handle,
	displayName: null,
	firstName: null,
	middleName: null,
	lastName: null,
	headline: null,
	bio: null,
	interests: [],
	location: null,
	isPublic: true,
	avatarImageId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
});

const makePage = (handle = "spats") => ({
	id: "page-1",
	name: "Spats",
	handle,
	headline: null,
	bio: null,
	interests: [],
	location: null,
	avatarImageId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	createdByUserId: "user-1",
});

// ---------------------------------------------------------------------------
// isHandleTaken — UX pre-check (DB unique constraint is the real guarantee)
// ---------------------------------------------------------------------------
describe("isHandleTaken", () => {
	beforeEach(() => vi.clearAllMocks());

	test("returns true when a Handle row exists", async () => {
		vi.mocked(prisma.handle.findUnique).mockResolvedValue(
			makeHandleRow({ handle: "laurel", userId: "user-1" }) as unknown as never,
		);
		expect(await isHandleTaken("laurel")).toBe(true);
	});

	test("returns false when no Handle row exists", async () => {
		vi.mocked(prisma.handle.findUnique).mockResolvedValue(null);
		expect(await isHandleTaken("nope")).toBe(false);
	});

	test("lowercases input before lookup (handles are stored lowercase)", async () => {
		vi.mocked(prisma.handle.findUnique).mockResolvedValue(null);
		await isHandleTaken("Laurel");
		expect(vi.mocked(prisma.handle.findUnique)).toHaveBeenCalledWith({
			where: { handle: "laurel" },
		});
	});

	test("works for already-lowercase input (idempotent normalization)", async () => {
		vi.mocked(prisma.handle.findUnique).mockResolvedValue(null);
		await isHandleTaken("laurel");
		expect(vi.mocked(prisma.handle.findUnique)).toHaveBeenCalledWith({
			where: { handle: "laurel" },
		});
	});
});

// ---------------------------------------------------------------------------
// findEntityByHandle — single lookup that powers /[handle] routing
// ---------------------------------------------------------------------------
describe("findEntityByHandle", () => {
	beforeEach(() => vi.clearAllMocks());

	test("returns the row with user populated when handle belongs to a User", async () => {
		const user = makeUser("laurel");
		vi.mocked(prisma.handle.findUnique).mockResolvedValue({
			...makeHandleRow({ handle: "laurel", userId: user.id }),
			user,
			page: null,
		} as unknown as never);

		const result = await findEntityByHandle("laurel");
		expect(result?.user).toEqual(user);
		expect(result?.page).toBeNull();
	});

	test("returns the row with page populated when handle belongs to a Page", async () => {
		const page = makePage("spats");
		vi.mocked(prisma.handle.findUnique).mockResolvedValue({
			...makeHandleRow({ handle: "spats", pageId: page.id }),
			user: null,
			page,
		} as unknown as never);

		const result = await findEntityByHandle("spats");
		expect(result?.page).toEqual(page);
		expect(result?.user).toBeNull();
	});

	test("returns null when no handle matches", async () => {
		vi.mocked(prisma.handle.findUnique).mockResolvedValue(null);
		expect(await findEntityByHandle("nope")).toBeNull();
	});

	test("lowercases input and includes both user and page relations", async () => {
		vi.mocked(prisma.handle.findUnique).mockResolvedValue(null);
		await findEntityByHandle("Laurel");
		expect(vi.mocked(prisma.handle.findUnique)).toHaveBeenCalledWith({
			where: { handle: "laurel" },
			include: { user: true, page: true },
		});
	});
});
