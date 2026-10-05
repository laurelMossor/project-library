import { describe, test, expect, vi, beforeEach } from "vitest";

const tx = {
	$queryRaw: vi.fn(),
	page: { findMany: vi.fn(), updateMany: vi.fn() },
	post: { findMany: vi.fn(), updateMany: vi.fn() },
	event: { findMany: vi.fn(), updateMany: vi.fn() },
	message: { updateMany: vi.fn() },
	comment: { updateMany: vi.fn() },
	rsvp: { findMany: vi.fn(), update: vi.fn() },
	rsvpGuest: { updateMany: vi.fn() },
	image: { findMany: vi.fn() },
	conversationParticipant: { findMany: vi.fn() },
	emailOutbox: { deleteMany: vi.fn() },
	user: { delete: vi.fn() },
};

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (client: typeof tx) => Promise<string[]>) => fn(tx)),
	},
}));
vi.mock("@/lib/utils/server/permission", () => ({
	getSoleAdminPages: vi.fn(),
	getSuccessorAdminIds: vi.fn(),
	lockPageAdminChanges: vi.fn(),
}));
vi.mock("@/lib/utils/server/page", () => ({
	deletePage: vi.fn(),
	deleteConversationsIfEmpty: vi.fn(),
}));
vi.mock("@/lib/utils/server/image-attachment", () => ({
	collectOrphanedImages: vi.fn(async () => []),
	detachAllForTargets: vi.fn(async () => []),
}));

import { AccountDeleteConflict, deleteAccount } from "@/lib/utils/server/user";
import { getSoleAdminPages, getSuccessorAdminIds } from "@/lib/utils/server/permission";
import { deletePage } from "@/lib/utils/server/page";

function emptyReads() {
	tx.page.findMany.mockResolvedValue([]);
	tx.post.findMany.mockResolvedValue([]);
	tx.event.findMany.mockResolvedValue([]);
	tx.rsvp.findMany.mockResolvedValue([]);
	tx.image.findMany.mockResolvedValue([]);
	tx.conversationParticipant.findMany.mockResolvedValue([]);
	vi.mocked(getSuccessorAdminIds).mockResolvedValue(new Map());
}

beforeEach(() => {
	vi.clearAllMocks();
	emptyReads();
});

describe("deleteAccount decisions", () => {
	test("a stale sole-admin list throws and does not delete a page", async () => {
		vi.mocked(getSoleAdminPages)
			.mockResolvedValueOnce([{ id: "p1", name: "One", handle: "one" }])
			.mockResolvedValueOnce([
				{ id: "p1", name: "One", handle: "one" },
				{ id: "p2", name: "Two", handle: "two" },
			]);

		await expect(deleteAccount("u1", ["p1"])).rejects.toBeInstanceOf(AccountDeleteConflict);
		expect(deletePage).not.toHaveBeenCalled();
		expect(tx.user.delete).not.toHaveBeenCalled();
	});

	test("a created page with no successor throws and is not deleted", async () => {
		vi.mocked(getSoleAdminPages).mockResolvedValue([]);
		tx.page.findMany.mockResolvedValueOnce([{ id: "p1" }]);

		await expect(deleteAccount("u1", [])).rejects.toBeInstanceOf(AccountDeleteConflict);
		expect(deletePage).not.toHaveBeenCalled();
		expect(tx.user.delete).not.toHaveBeenCalled();
	});

	test("a page the user only spoke as, with no successor, is left in place", async () => {
		vi.mocked(getSoleAdminPages).mockResolvedValue([]);
		tx.post.findMany.mockResolvedValueOnce([{ asPageId: "p-voice" }]);

		await expect(deleteAccount("u1", [])).resolves.toEqual([]);
		expect(deletePage).not.toHaveBeenCalled();
		expect(tx.page.updateMany).not.toHaveBeenCalled();
		expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
	});
});
