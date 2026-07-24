/**
 * Route tests for the relaxed publish gate in PATCH /api/posts/[id].
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
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn() }));
vi.mock("@/lib/utils/server/user", () => ({ publicUserEmbedFields: {} }));
vi.mock("@/lib/utils/server/visibility", () => ({
	getViewerContext: vi.fn(),
	canViewPost: vi.fn().mockResolvedValue(true),
	isContentOwner: vi.fn().mockResolvedValue(true),
	requireViewablePost: vi.fn(),
	resolveParentVisibility: vi.fn(),
	syncDescendantVisibility: vi.fn(),
}));
vi.mock("@/lib/utils/errors", () => ({
	unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
	badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
	notFound: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 404 }),
	serverError: () => new Response(JSON.stringify({ error: "err" }), { status: 500 }),
}));

import { PATCH } from "@/app/api/posts/[id]/route";
import { prisma } from "@/lib/utils/server/prisma";
import { getViewerContext, requireViewablePost } from "@/lib/utils/server/visibility";

const patch = (body: unknown) => {
	const req = new Request("http://localhost/api/posts/post-1", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return PATCH(req, { params: Promise.resolve({ id: "post-1" }) });
};

beforeEach(() => {
	vi.clearAllMocks();
	tx.post.update.mockResolvedValue({ id: "post-1", status: "PUBLISHED" });
	vi.mocked(getViewerContext).mockResolvedValue({ userId: "u1" } as never);
	vi.mocked(requireViewablePost).mockResolvedValue({
		id: "post-1", userId: "u1", pageId: null, eventId: null,
		parentPostId: null, status: "DRAFT", contentVisibility: "LISTED",
	} as never);
	// Stored draft is empty (no title, no body) — the image count decides.
	vi.mocked(prisma.post.findUnique).mockResolvedValue({ title: null, content: "" } as never);
});

describe("PATCH /api/posts/[id] — publish gate", () => {
	test("publishes with body text (no images needed)", async () => {
		const res = await patch({ status: "PUBLISHED", content: "Something to say" });
		expect(res.status).toBe(200);
		expect(prisma.imageAttachment.count).not.toHaveBeenCalled(); // short-circuit on text
	});

	test("publishes with a title only", async () => {
		const res = await patch({ status: "PUBLISHED", title: "A title" });
		expect(res.status).toBe(200);
	});

	test("publishes an image-only post (no title/body, one attachment)", async () => {
		vi.mocked(prisma.imageAttachment.count).mockResolvedValue(1 as never);
		const res = await patch({ status: "PUBLISHED" });
		expect(res.status).toBe(200);
		expect(prisma.imageAttachment.count).toHaveBeenCalledWith({ where: { type: "POST", targetId: "post-1" } });
	});

	test("blocks a fully empty post (no title, no body, no images)", async () => {
		vi.mocked(prisma.imageAttachment.count).mockResolvedValue(0 as never);
		const res = await patch({ status: "PUBLISHED" });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: expect.stringMatching(/empty post/i) });
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});
});
