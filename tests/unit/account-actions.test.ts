/**
 * Account lifecycle actions: delete account (settings), complete setup, and delete from the setup screen.
 * The setup delete only works on an unfinished account, so a second tab can't delete a finished one.
 * Mocks prisma, the session, and storage; the real action wrapper and user utils run.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		user: { findUnique: vi.fn(), update: vi.fn() },
		$transaction: vi.fn(),
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { completeSetupAction, deleteAccountAction, deleteUnfinishedAccountAction } from "@/lib/actions/account";
import { AccountDeleteConflict, SetupAlreadyFinished } from "@/lib/utils/server/user";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { removeStoragePaths } from "@/lib/utils/server/storage";
import { refresh } from "next/cache";

const FINISHED_MSG = "This account is already set up — delete it from Settings.";

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: null });
});

describe("completeSetupAction", () => {
	test("anonymous → unauthorized, nothing written", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null);
		expect(await completeSetupAction()).toMatchObject({ ok: false, error: "unauthorized" });
		expect(prisma.user.update).not.toHaveBeenCalled();
	});

	test("marks the signed-in user complete, without refreshing", async () => {
		vi.mocked(prisma.user.update).mockResolvedValue({} as never);
		expect((await completeSetupAction()).ok).toBe(true);
		expect(prisma.user.update).toHaveBeenCalledWith({
			where: { id: "u1" },
			data: { setupCompletedAt: expect.any(Date) },
		});
		expect(refresh).not.toHaveBeenCalled();
	});
});

describe("deleteUnfinishedAccountAction", () => {
	test("anonymous → unauthorized", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null);
		expect(await deleteUnfinishedAccountAction()).toMatchObject({ ok: false, error: "unauthorized" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("unfinished account → deletes in the unfinished-only mode and removes its files", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ setupCompletedAt: null } as never);
		vi.mocked(prisma.$transaction).mockResolvedValue(["avatars/a.png"] as never);
		expect((await deleteUnfinishedAccountAction()).ok).toBe(true);
		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
		expect(removeStoragePaths).toHaveBeenCalledWith(["avatars/a.png"]);
	});

	test("finished account → conflict, nothing deleted", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ setupCompletedAt: new Date() } as never);
		const result = await deleteUnfinishedAccountAction();
		expect(result).toEqual({ ok: false, error: "conflict", message: FINISHED_MSG });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("missing user → not_found", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
		expect(await deleteUnfinishedAccountAction()).toMatchObject({ ok: false, error: "not_found" });
	});

	test("finished between the check and the lock → conflict", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ setupCompletedAt: null } as never);
		vi.mocked(prisma.$transaction).mockRejectedValue(new SetupAlreadyFinished());
		const result = await deleteUnfinishedAccountAction();
		expect(result).toEqual({ ok: false, error: "conflict", message: FINISHED_MSG });
		expect(removeStoragePaths).not.toHaveBeenCalled();
	});

	test("sole-admin conflict → conflict with the conflict message", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue({ setupCompletedAt: null } as never);
		vi.mocked(prisma.$transaction).mockRejectedValue(new AccountDeleteConflict());
		const result = await deleteUnfinishedAccountAction();
		expect(result).toMatchObject({ ok: false, error: "conflict" });
		expect(!result.ok && result.message).toMatch(/have changed/);
	});
});

describe("deleteAccountAction", () => {
	test("anonymous → unauthorized", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null);
		expect(await deleteAccountAction({ expectedPageIds: [] })).toMatchObject({ ok: false, error: "unauthorized" });
	});

	test("a malformed page list is refused before any delete", async () => {
		const result = await deleteAccountAction({ expectedPageIds: [1] as never });
		expect(result).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("deletes the account and removes its files, without refreshing", async () => {
		vi.mocked(prisma.$transaction).mockResolvedValue(["img/1.png"] as never);
		expect((await deleteAccountAction({ expectedPageIds: ["p1"] })).ok).toBe(true);
		expect(removeStoragePaths).toHaveBeenCalledWith(["img/1.png"]);
		expect(refresh).not.toHaveBeenCalled();
	});

	test("a stale sole-admin list → conflict so the client refetches", async () => {
		vi.mocked(prisma.$transaction).mockRejectedValue(new AccountDeleteConflict());
		const result = await deleteAccountAction({ expectedPageIds: [] });
		expect(result).toMatchObject({ ok: false, error: "conflict" });
		expect(removeStoragePaths).not.toHaveBeenCalled();
	});
});
