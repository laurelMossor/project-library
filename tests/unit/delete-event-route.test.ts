/**
 * removeEvent (src/lib/utils/server/event.ts): gate, then delete, then blob cleanup —
 * in that order, so a failed delete never drops the photos.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/lib/utils/server/visibility", () => ({
	requireViewableEvent: vi.fn(),
	canViewEvent: vi.fn(),
	isContentOwner: vi.fn(),
	resolveParentVisibility: vi.fn(),
	syncDescendantVisibility: vi.fn(),
}));
vi.mock("@/lib/utils/server/permission", () => ({
	canEditContent: vi.fn(),
	canModerateContent: vi.fn(),
	canPostAsPage: vi.fn(),
}));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));

import { removeEvent } from "@/lib/utils/server/event";
import { prisma } from "@/lib/utils/server/prisma";
import { requireViewableEvent } from "@/lib/utils/server/visibility";
import { canModerateContent } from "@/lib/utils/server/permission";
import { removeStoragePaths } from "@/lib/utils/server/storage";

const viewer = { userId: "u1", memberPageIds: [] };

beforeEach(() => vi.clearAllMocks());

describe("removeEvent", () => {
	test("removes storage paths only after the delete transaction commits", async () => {
		vi.mocked(requireViewableEvent).mockResolvedValue({ id: "event-1" } as never);
		vi.mocked(canModerateContent).mockResolvedValue(true);
		// deleteEvent's transaction returns the detached blob paths.
		vi.mocked(prisma.$transaction).mockResolvedValue(["uploads/cover.jpg"] as never);

		await removeEvent(viewer, "event-1");

		expect(prisma.$transaction).toHaveBeenCalledOnce();
		expect(removeStoragePaths).toHaveBeenCalledWith(["uploads/cover.jpg"]);
	});

	test("an event the viewer can't moderate → forbidden, nothing deleted", async () => {
		vi.mocked(requireViewableEvent).mockResolvedValue({ id: "event-1" } as never);
		vi.mocked(canModerateContent).mockResolvedValue(false);
		await expect(removeEvent(viewer, "event-1")).rejects.toMatchObject({ code: "forbidden" });
		expect(prisma.$transaction).not.toHaveBeenCalled();
		expect(removeStoragePaths).not.toHaveBeenCalled();
	});

	test("an event the viewer can't see → not_found", async () => {
		vi.mocked(requireViewableEvent).mockResolvedValue(null);
		await expect(removeEvent(viewer, "event-1")).rejects.toMatchObject({ code: "not_found" });
	});
});
