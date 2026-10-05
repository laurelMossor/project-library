import { describe, test, expect, vi, beforeEach } from "vitest";
import { AttachmentTarget } from "@prisma/client";

const tx = {
	$queryRaw: vi.fn(),
	post: { findMany: vi.fn() },
	event: { delete: vi.fn() },
};

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		$transaction: vi.fn(async (fn: (client: typeof tx) => Promise<string[]>) => fn(tx)),
	},
}));
vi.mock("@/lib/utils/server/image-attachment", () => ({
	detachAllForTargets: vi.fn(),
	getImagesForTarget: vi.fn(),
	getImagesForTargetsBatch: vi.fn(),
}));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));
vi.mock("@/lib/utils/server/visibility", () => ({
	authorProfilePlacementWhere: vi.fn(),
	collectionVisibilityWhere: vi.fn(),
	draftsOnPageWhere: vi.fn(),
}));

import { deleteEvent } from "@/lib/utils/server/event";
import { detachAllForTargets } from "@/lib/utils/server/image-attachment";
import { removeStoragePaths } from "@/lib/utils/server/storage";

beforeEach(() => {
	vi.clearAllMocks();
	tx.post.findMany.mockResolvedValue([{ id: "update-1" }]);
	tx.event.delete.mockResolvedValue({});
	vi.mocked(detachAllForTargets).mockResolvedValue(["uploads/update.jpg"]);
});

describe("deleteEvent", () => {
	test("detaches the event and its update posts, and leaves blob removal to the caller", async () => {
		const paths = await deleteEvent("event-1");

		expect(paths).toEqual(["uploads/update.jpg"]);
		expect(detachAllForTargets).toHaveBeenCalledWith(
			[
				{ type: AttachmentTarget.EVENT, targetId: "event-1" },
				{ type: AttachmentTarget.POST, targetId: "update-1" },
			],
			tx,
		);
		expect(tx.event.delete).toHaveBeenCalledWith({ where: { id: "event-1" } });
		expect(removeStoragePaths).not.toHaveBeenCalled();
	});
});
