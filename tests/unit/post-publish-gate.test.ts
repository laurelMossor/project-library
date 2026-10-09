/**
 * The relaxed publish gate in updatePost (src/lib/utils/server/post.ts).
 * A post is publishable with a title, a body, OR at least one photo — the empty
 * case (no title, no body, zero image attachments) is the only one blocked.
 * Prisma, visibility, and permission helpers are mocked — no DB needed.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const tx = {
	post: {
		update: vi.fn().mockResolvedValue({ id: "post-1", status: "PUBLISHED" }),
		updateMany: vi.fn().mockResolvedValue({ count: 0 }),
	},
};

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		$transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
		post: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
		imageAttachment: { count: vi.fn().mockResolvedValue(0) },
	},
}));
vi.mock("@/lib/utils/server/permission", () => ({
	canPostAsPage: vi.fn(),
	canEditContent: vi.fn().mockResolvedValue(true),
	canModerateContent: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/utils/server/user", () => ({ publicUserEmbedFields: {} }));
vi.mock("@/lib/utils/server/visibility", () => ({
	canViewPost: vi.fn().mockResolvedValue(true),
	isContentOwner: vi.fn().mockResolvedValue(true),
	requireViewablePost: vi.fn(),
	resolveParentVisibility: vi.fn(),
	syncDescendantVisibility: vi.fn(),
}));

import { updatePost } from "@/lib/utils/server/post";
import { prisma } from "@/lib/utils/server/prisma";
import { requireViewablePost } from "@/lib/utils/server/visibility";

const publish = (data: Parameters<typeof updatePost>[2]) => updatePost({ userId: "u1", memberPageIds: [] }, "post-1", data);

beforeEach(() => {
	vi.clearAllMocks();
	tx.post.update.mockResolvedValue({ id: "post-1", status: "PUBLISHED" });
	vi.mocked(requireViewablePost).mockResolvedValue({
		id: "post-1", userId: "u1", pageId: null, eventId: null,
		parentPostId: null, status: "DRAFT", contentVisibility: "LISTED",
	} as never);
	// Stored draft is empty (no title, no body) — the image count decides.
	vi.mocked(prisma.post.findUnique).mockResolvedValue({ title: null, content: "" } as never);
});

describe("updatePost — publish gate", () => {
	test("publishes with body text (no images needed)", async () => {
		await publish({ status: "PUBLISHED", content: "Something to say" });
		expect(tx.post.update).toHaveBeenCalled();
		expect(prisma.imageAttachment.count).not.toHaveBeenCalled(); // short-circuit on text
	});

	test("publishes with a title only", async () => {
		await publish({ status: "PUBLISHED", title: "A title" });
		expect(tx.post.update).toHaveBeenCalled();
	});

	test("publishes an image-only post (no title/body, one attachment)", async () => {
		vi.mocked(prisma.imageAttachment.count).mockResolvedValue(1 as never);
		await publish({ status: "PUBLISHED" });
		expect(prisma.imageAttachment.count).toHaveBeenCalledWith({ where: { type: "POST", targetId: "post-1" } });
	});

	test("blocks a fully empty post (no title, no body, no images)", async () => {
		vi.mocked(prisma.imageAttachment.count).mockResolvedValue(0 as never);
		await expect(publish({ status: "PUBLISHED" })).rejects.toMatchObject({
			code: "invalid",
			message: expect.stringMatching(/empty post/i),
		});
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});
