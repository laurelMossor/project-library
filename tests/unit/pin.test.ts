import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		post: { count: vi.fn() },
		event: { count: vi.fn() },
	},
}));

import { otherPinnedCount, MAX_PINNED_PER_PROFILE } from "@/lib/utils/server/pin";
import { prisma } from "@/lib/utils/server/prisma";

describe("otherPinnedCount", () => {
	beforeEach(() => vi.clearAllMocks());

	test("counts posts and events on one profile together", async () => {
		vi.mocked(prisma.post.count).mockResolvedValue(2);
		vi.mocked(prisma.event.count).mockResolvedValue(1);
		expect(MAX_PINNED_PER_PROFILE).toBe(3);
		expect(await otherPinnedCount({ pageId: "page-1" }, { postId: "post-1" })).toBe(3);
	});

	test("personal pins are the author's items with no page", async () => {
		vi.mocked(prisma.post.count).mockResolvedValue(0);
		vi.mocked(prisma.event.count).mockResolvedValue(0);
		await otherPinnedCount({ userId: "user-1" }, { eventId: "event-1" });
		expect(prisma.event.count).toHaveBeenCalledWith({
			where: { userId: "user-1", pageId: null, pinnedAt: { not: null }, id: { not: "event-1" } },
		});
	});
});
