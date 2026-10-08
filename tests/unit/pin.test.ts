import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		post: { count: vi.fn() },
		event: { count: vi.fn() },
	},
}));

vi.mock("@/lib/utils/server/permission", () => ({
	canPostAsPage: vi.fn(),
}));

import { MAX_PINNED_PER_PROFILE, pinnedCountInScope } from "@/lib/const/pin";
import { canPinContent, otherPinnedCount, withCanPin } from "@/lib/utils/server/pin";
import { canPostAsPage } from "@/lib/utils/server/permission";
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

describe("canPinContent", () => {
	beforeEach(() => vi.clearAllMocks());

	test("author on a personal post → true", async () => {
		expect(await canPinContent("author", { userId: "author", pageId: null })).toBe(true);
		expect(canPostAsPage).not.toHaveBeenCalled();
	});

	test("page manager on a member's post on their page → true", async () => {
		vi.mocked(canPostAsPage).mockResolvedValue(true);
		expect(await canPinContent("editor", { userId: "member", pageId: "page-1" })).toBe(true);
		expect(canPostAsPage).toHaveBeenCalledWith("editor", "page-1");
	});

	test("member on someone else's post → false", async () => {
		vi.mocked(canPostAsPage).mockResolvedValue(false);
		expect(await canPinContent("member", { userId: "someone", pageId: "page-1" })).toBe(false);
	});

	test("stranger → false", async () => {
		expect(await canPinContent(null, { userId: "author", pageId: null })).toBe(false);
		vi.mocked(canPostAsPage).mockResolvedValue(false);
		expect(await canPinContent("stranger", { userId: "author", pageId: "page-1" })).toBe(false);
	});
});

describe("pinnedCountInScope", () => {
	const items = [
		{ userId: "author", pageId: null, pinnedAt: new Date("2026-01-01") },
		{ userId: "author", pageId: null, pinnedAt: new Date("2026-01-02") },
		{ userId: "author", pageId: "page-1", pinnedAt: new Date("2026-01-03") },
		{ userId: "author", pageId: "page-1", pinnedAt: new Date("2026-01-04") },
		{ userId: "author", pageId: null, pinnedAt: null },
	];

	test("personal pins and page pins are counted apart", () => {
		expect(pinnedCountInScope(items, { userId: "author" })).toBe(2);
		expect(pinnedCountInScope(items, { pageId: "page-1" })).toBe(2);
	});
});

describe("withCanPin", () => {
	beforeEach(() => vi.clearAllMocks());

	const pageItem = { userId: "author", pageId: "page-1" };

	test("a page item on the author's profile is not pinnable there", async () => {
		vi.mocked(canPostAsPage).mockResolvedValue(true);
		const [stamped] = await withCanPin([pageItem], "editor", { userId: "author" });
		expect(stamped.canPin).toBe(false);
		expect(canPostAsPage).not.toHaveBeenCalled();
	});

	test("the same page item is pinnable on that page", async () => {
		vi.mocked(canPostAsPage).mockResolvedValue(true);
		const [stamped] = await withCanPin([pageItem], "editor", { pageId: "page-1" });
		expect(stamped.canPin).toBe(true);
		expect(canPostAsPage).toHaveBeenCalledWith("editor", "page-1");
	});
});
