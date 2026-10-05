import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/utils/server/visibility", () => ({
	getViewerContext: vi.fn(),
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
vi.mock("@/lib/utils/server/event", () => ({ deleteEvent: vi.fn() }));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));
vi.mock("@/lib/utils/server/image-attachment", () => ({ getImagesForTarget: vi.fn() }));
vi.mock("@/lib/utils/server/content-placement", () => ({
	PlacementError: class PlacementError extends Error {},
	resolveContentPlacement: vi.fn(),
}));

import { DELETE } from "@/app/api/events/[id]/route";
import { getViewerContext, requireViewableEvent } from "@/lib/utils/server/visibility";
import { canModerateContent } from "@/lib/utils/server/permission";
import { deleteEvent } from "@/lib/utils/server/event";
import { removeStoragePaths } from "@/lib/utils/server/storage";

const ctx = { params: Promise.resolve({ id: "event-1" }) };

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/events/:id", () => {
	test("removes storage paths only after deleteEvent commits", async () => {
		vi.mocked(getViewerContext).mockResolvedValue({ userId: "u1" } as never);
		vi.mocked(requireViewableEvent).mockResolvedValue({ id: "event-1" } as never);
		vi.mocked(canModerateContent).mockResolvedValue(true);
		vi.mocked(deleteEvent).mockResolvedValue(["uploads/cover.jpg"]);

		const res = await DELETE(new Request("http://localhost/api/events/event-1"), ctx);

		expect(res.status).toBe(200);
		expect(deleteEvent).toHaveBeenCalledWith("event-1");
		expect(removeStoragePaths).toHaveBeenCalledWith(["uploads/cover.jpg"]);
	});
});
