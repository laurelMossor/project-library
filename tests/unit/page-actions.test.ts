/**
 * createPageAction accepts an optional cuid-shaped id so the create form can preview the avatar the page
 * will keep. A bad id is refused; a taken id asks the caller to try again, distinct from a taken handle.
 * deletePageAction is the admin-only page delete (was DELETE /api/pages/:id).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { createCuid } from "@/lib/utils/cuid";

const tx = { page: { findUnique: vi.fn() } };

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: { $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({
	assertCanManagePage: vi.fn(),
	lockPageAdminChanges: vi.fn(),
	grantPermission: vi.fn(),
	revokeAllForResource: vi.fn(),
}));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));
vi.mock("@/lib/utils/server/handle", () => ({
	generateUniqueHandle: vi.fn(),
	isHandleTaken: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/utils/server/log", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/utils/server/page", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/utils/server/page")>()),
	createPage: vi.fn(),
}));

import { createPageAction, deletePageAction } from "@/lib/actions/page";
import { getSessionContext } from "@/lib/utils/server/session";
import { assertCanManagePage } from "@/lib/utils/server/permission";
import { DomainError } from "@/lib/utils/server/domain-error";
import { createPage } from "@/lib/utils/server/page";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getSessionContext).mockResolvedValue({ userId: "u1", activePageId: null });
	vi.mocked(createPage).mockResolvedValue({ id: "page-1", handle: "makers" } as never);
	tx.page.findUnique.mockResolvedValue(null);
});

describe("createPageAction", () => {
	test("anonymous → unauthorized", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null);
		expect(await createPageAction({ name: "Makers", handle: "makers" })).toMatchObject({ ok: false, error: "unauthorized" });
		expect(createPage).not.toHaveBeenCalled();
	});

	test("a valid new id is accepted and passed through; returns id + handle", async () => {
		const id = createCuid();
		const result = await createPageAction({ id, name: "Makers", handle: "makers" });
		expect(result).toEqual({ ok: true, data: { id: "page-1", handle: "makers" } });
		expect(createPage).toHaveBeenCalledWith("u1", expect.objectContaining({ id, name: "Makers", handle: "makers" }));
	});

	test("a malformed id is refused", async () => {
		const result = await createPageAction({ id: "not-a-cuid", name: "Makers", handle: "makers" });
		expect(result).toMatchObject({ ok: false, error: "invalid", message: "Invalid page id" });
		expect(createPage).not.toHaveBeenCalled();
	});

	test("a missing name is refused", async () => {
		const result = await createPageAction({ name: "  ", handle: "makers" });
		expect(result).toMatchObject({ ok: false, error: "invalid", message: "Name is required" });
	});

	test("a taken id asks the caller to try again", async () => {
		vi.mocked(createPage).mockRejectedValue({ code: "P2002", meta: { target: ["id"] } });
		const result = await createPageAction({ id: createCuid(), name: "Makers", handle: "makers" });
		expect(result).toMatchObject({ ok: false, error: "invalid" });
		expect(!result.ok && result.message).toMatch(/try again/i);
	});

	test("a handle that loses the race is reported as taken", async () => {
		vi.mocked(createPage).mockRejectedValue({ code: "P2002", meta: { target: ["handle"] } });
		const result = await createPageAction({ name: "Makers", handle: "makers" });
		expect(result).toMatchObject({ ok: false, error: "conflict", message: "That handle is already taken" });
	});

	test("a private page with no content visibility is refused, and nothing is created", async () => {
		const result = await createPageAction({ name: "Makers", handle: "makers", profileVisibility: "PRIVATE" });
		expect(result).toMatchObject({
			ok: false,
			error: "invalid",
			message: "A private profile can't have listed content — choose Unlisted or Private for your posts.",
		});
		expect(createPage).not.toHaveBeenCalled();
	});
});

describe("deletePageAction", () => {
	test("anonymous → unauthorized, nothing deleted", async () => {
		vi.mocked(getSessionContext).mockResolvedValue(null);
		expect(await deletePageAction({ id: "p1" })).toMatchObject({ ok: false, error: "unauthorized" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("non-admin → forbidden, nothing deleted", async () => {
		vi.mocked(assertCanManagePage).mockRejectedValue(
			new DomainError("You do not have permission to manage this page", "forbidden"),
		);
		expect(await deletePageAction({ id: "p1" })).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	test("admin → deletes inside a transaction", async () => {
		vi.mocked(assertCanManagePage).mockResolvedValue(undefined);
		const result = await deletePageAction({ id: "p1" });
		expect(result.ok).toBe(true);
		expect(assertCanManagePage).toHaveBeenCalledWith("u1", "p1");
		expect(prisma.$transaction).toHaveBeenCalledTimes(1);
		expect(tx.page.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" } }));
	});

	test("missing id → invalid", async () => {
		expect(await deletePageAction({ id: "" })).toMatchObject({ ok: false, error: "invalid" });
	});
});
