/**
 * Tests for the auto-generated-handle helpers added with the signup rework:
 *   - generateUniqueHandle — derive a valid, free handle from an email seed, retrying on collision
 *   - setUserHandle        — validate + atomically rename User.handle and the companion Handle row
 *
 * Prisma is mocked; validateHandle / isReservedHandle run for real (they're pure).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		handle: { findUnique: vi.fn(), upsert: vi.fn() },
		user: { findUnique: vi.fn(), update: vi.fn() },
		$transaction: vi.fn(),
	},
}));

import { generateUniqueHandle, setUserHandle } from "@/lib/utils/server/handle";
import { prisma } from "@/lib/utils/server/prisma";
import { validateHandle } from "@/lib/validations";
import { RESERVED_HANDLES } from "@/lib/const/reserved-handles";

const findUnique = vi.mocked(prisma.handle.findUnique);
const userFindUnique = vi.mocked(prisma.user.findUnique);
const tx = vi.mocked(prisma.$transaction);

// A reserved handle that also passes the format check (≥3 chars, valid charset).
const RESERVED_VALID = [...RESERVED_HANDLES].find((h) => validateHandle(h))!;

// ---------------------------------------------------------------------------
// generateUniqueHandle
// ---------------------------------------------------------------------------
describe("generateUniqueHandle", () => {
	beforeEach(() => vi.clearAllMocks());

	test("derives the bare base from the email local-part when free", async () => {
		findUnique.mockResolvedValue(null); // nothing taken
		const handle = await generateUniqueHandle("jane.doe@example.com");
		expect(handle).toBe("janedoe"); // '.' stripped to the valid charset
	});

	test("appends a suffix when the bare base is taken", async () => {
		// First candidate (bare "janedoe") is taken; the next (suffixed) is free. Candidates
		// are checked in order, so ordered mock returns model exactly that.
		findUnique
			.mockResolvedValueOnce({ id: "h" } as never)
			.mockResolvedValue(null);
		const handle = await generateUniqueHandle("janedoe@example.com");
		expect(handle).not.toBe("janedoe");
		expect(handle.startsWith("janedoe-")).toBe(true);
		expect(validateHandle(handle)).toBe(true);
	});

	test("falls back to a neutral base for a too-short/empty local-part", async () => {
		findUnique.mockResolvedValue(null);
		const handle = await generateUniqueHandle("a@example.com");
		expect(handle).toBe("membera");
		expect(validateHandle(handle)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// setUserHandle
// ---------------------------------------------------------------------------
describe("setUserHandle", () => {
	beforeEach(() => vi.clearAllMocks());

	test("rejects an invalid handle without touching the DB", async () => {
		const result = await setUserHandle("u1", "ab"); // too short
		expect(result.ok).toBe(false);
		expect(userFindUnique).not.toHaveBeenCalled();
	});

	test("rejects a reserved handle", async () => {
		const result = await setUserHandle("u1", RESERVED_VALID);
		expect(result.ok).toBe(false);
		expect(userFindUnique).not.toHaveBeenCalled();
	});

	test("is a no-op success when unchanged (no write, no taken-check)", async () => {
		userFindUnique.mockResolvedValue({ handle: "janedoe" } as never);
		const result = await setUserHandle("u1", "janedoe");
		expect(result).toEqual({ ok: true, handle: "janedoe" });
		expect(findUnique).not.toHaveBeenCalled(); // isHandleTaken skipped
		expect(tx).not.toHaveBeenCalled();
	});

	test("rejects when the target handle is taken by someone else", async () => {
		userFindUnique.mockResolvedValue({ handle: "old" } as never);
		findUnique.mockResolvedValue({ id: "h" } as never); // taken
		const result = await setUserHandle("u1", "newname");
		expect(result.ok).toBe(false);
		expect(tx).not.toHaveBeenCalled();
	});

	test("renames atomically on the happy path", async () => {
		userFindUnique.mockResolvedValue({ handle: "old" } as never);
		findUnique.mockResolvedValue(null); // free
		tx.mockResolvedValue([] as never);
		const result = await setUserHandle("u1", "NewName"); // also lowercases
		expect(result).toEqual({ ok: true, handle: "newname" });
		expect(tx).toHaveBeenCalledTimes(1);
	});
});
