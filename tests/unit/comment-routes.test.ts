/**
 * Integration-style route tests for the comment endpoints — the feature's security
 * boundary that comment-guards.test.ts (which mocks the visibility layer) cannot cover.
 *
 * Design: mock ONLY the two real seams — `prisma` and `getSessionContext` — and let the
 * genuine gate run: getViewerContext → requireViewablePost/Event → canViewPost/Event →
 * isContentOwner → canManageEntity → canPostAsPage → createComment → canModerateComment/
 * canEditComment. So a broken gate actually fails a test, rather than the test echoing a
 * mocked verdict. `errors` stays real (assert genuine status codes); rate-limit and
 * activity are stubbed as orthogonal concerns. Mirrors require-viewable/message-scoping,
 * which also mock Prisma only.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		post: { findUnique: vi.fn() },
		event: { findUnique: vi.fn() },
		permission: { findMany: vi.fn(), findFirst: vi.fn() },
		follow: { findFirst: vi.fn() },
		comment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));

import { GET as postCommentsGET, POST as postCommentsPOST } from "@/app/api/posts/[id]/comments/route";
import { GET as eventCommentsGET } from "@/app/api/events/[id]/comments/route";
import { DELETE, PATCH } from "@/app/api/comments/[id]/route";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";

// --- seam helpers -----------------------------------------------------------

/** Set the session identity (null = anonymous). */
function asViewer(userId: string | null) {
	vi.mocked(getSessionContext).mockResolvedValue(userId ? { userId, activePageId: null } : (null as never));
}

type PostRow = { userId: string; pageId: string | null; status: "DRAFT" | "PUBLISHED"; contentVisibility: string };
function mockPost(row: PostRow) {
	vi.mocked(prisma.post.findUnique).mockResolvedValue({
		id: "p1", eventId: null, parentPostId: null, ...row,
	} as never);
}
type EventRow = { userId: string; pageId: string | null; status: "DRAFT" | "PUBLISHED"; contentVisibility: string };
function mockEvent(row: EventRow) {
	vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "e1", ...row } as never);
}
/** The comment row returned by getCommentForModeration (its author + parent target). */
function mockComment(row: { authorId: string; postId?: string | null; eventId?: string | null }) {
	vi.mocked(prisma.comment.findUnique).mockResolvedValue({
		id: "c1", postId: null, eventId: null, ...row,
	} as never);
}

const jsonReq = (method: string, body?: unknown) =>
	new Request("http://localhost/api/x", {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never); // viewer manages no pages
	vi.mocked(prisma.permission.findFirst).mockResolvedValue(null as never); // no ADMIN/EDITOR
	vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never); // no follow edge
	vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);
	vi.mocked(prisma.comment.create).mockResolvedValue({ id: "c1", authorId: "owner" } as never);
	vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);
	vi.mocked(prisma.comment.update).mockResolvedValue({ id: "c1" } as never);
});

const PUBLIC_POST: PostRow = { userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "LISTED" };

describe("POST /api/posts/[id]/comments — auth + parent gate", () => {
	test("anonymous → 401 (never reaches the parent)", async () => {
		asViewer(null);
		const res = await postCommentsPOST(jsonReq("POST", { content: "hi" }), ctx("p1"));
		expect(res.status).toBe(401);
		expect(prisma.post.findUnique).not.toHaveBeenCalled();
	});

	test("PRIVATE parent, viewer has no follow edge → 404 (real edge check runs)", async () => {
		asViewer("stranger");
		mockPost({ userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "PRIVATE" });
		const res = await postCommentsPOST(jsonReq("POST", { content: "hi" }), ctx("p1"));
		expect(res.status).toBe(404);
		expect(prisma.follow.findFirst).toHaveBeenCalled(); // the gate genuinely queried the edge
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});

	test("DRAFT parent, non-owner → 404 (real isContentOwner runs)", async () => {
		asViewer("stranger");
		mockPost({ userId: "owner", pageId: null, status: "DRAFT", contentVisibility: "LISTED" });
		const res = await postCommentsPOST(jsonReq("POST", { content: "hi" }), ctx("p1"));
		expect(res.status).toBe(404);
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});

	test("owner comments on their own viewable post → 201", async () => {
		asViewer("owner");
		mockPost(PUBLIC_POST);
		const res = await postCommentsPOST(jsonReq("POST", { content: "hi" }), ctx("p1"));
		expect(res.status).toBe(201);
		expect(prisma.comment.create).toHaveBeenCalled();
	});

	test("commenting as a page the viewer lacks ADMIN/EDITOR on → 403 (real canPostAsPage)", async () => {
		asViewer("u1");
		mockPost(PUBLIC_POST); // parent viewable → 403 (not 404)
		vi.mocked(prisma.permission.findFirst).mockResolvedValue(null as never); // no manage role on the page
		const res = await postCommentsPOST(jsonReq("POST", { content: "hi", asPageId: "page-x" }), ctx("p1"));
		expect(res.status).toBe(403);
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});
});

describe("GET comments — inherits the parent's viewability", () => {
	test("GET /posts/[id]/comments on a hidden post → 404", async () => {
		asViewer("stranger");
		mockPost({ userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "PRIVATE" });
		const res = await postCommentsGET(jsonReq("GET"), ctx("p1"));
		expect(res.status).toBe(404);
		expect(prisma.comment.findMany).not.toHaveBeenCalled();
	});

	test("GET /events/[id]/comments on a hidden event → 404 (event branch)", async () => {
		asViewer("stranger");
		mockEvent({ userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "PRIVATE" });
		const res = await eventCommentsGET(jsonReq("GET"), ctx("e1"));
		expect(res.status).toBe(404);
		expect(prisma.comment.findMany).not.toHaveBeenCalled();
	});

	test("GET on a viewable post → 200 with the list", async () => {
		asViewer("stranger");
		mockPost(PUBLIC_POST);
		const res = await postCommentsGET(jsonReq("GET"), ctx("p1"));
		expect(res.status).toBe(200);
		expect(prisma.comment.findMany).toHaveBeenCalled();
	});
});

describe("DELETE /api/comments/[id] — 404-before-403, then moderation authz", () => {
	test("parent unviewable → 404 (hidden parent can't be probed via its comment)", async () => {
		asViewer("stranger");
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost({ userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "PRIVATE" });
		const res = await DELETE(jsonReq("DELETE"), ctx("c1"));
		expect(res.status).toBe(404);
		expect(prisma.comment.delete).not.toHaveBeenCalled();
	});

	test("viewable parent, unrelated viewer → 403", async () => {
		asViewer("stranger");
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost(PUBLIC_POST);
		const res = await DELETE(jsonReq("DELETE"), ctx("c1"));
		expect(res.status).toBe(403);
		expect(prisma.comment.delete).not.toHaveBeenCalled();
	});

	test("content owner may delete someone else's comment → 200", async () => {
		asViewer("owner");
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost(PUBLIC_POST); // post.userId === "owner"
		const res = await DELETE(jsonReq("DELETE"), ctx("c1"));
		expect(res.status).toBe(200);
		expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
	});

	test("author may delete their own comment → 200", async () => {
		asViewer("author1");
		mockComment({ authorId: "author1", postId: "p1" });
		mockPost(PUBLIC_POST); // author1 is not the post owner
		const res = await DELETE(jsonReq("DELETE"), ctx("c1"));
		expect(res.status).toBe(200);
		expect(prisma.comment.delete).toHaveBeenCalled();
	});
});

describe("PATCH /api/comments/[id] — author-only edit (distinct from moderation)", () => {
	test("a content owner who is NOT the author cannot edit → 403", async () => {
		asViewer("owner"); // owns the post, but didn't write the comment
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost(PUBLIC_POST);
		const res = await PATCH(jsonReq("PATCH", { content: "rewrite" }), ctx("c1"));
		expect(res.status).toBe(403);
		expect(prisma.comment.update).not.toHaveBeenCalled();
	});

	test("the author may edit their own comment → 200", async () => {
		asViewer("author1");
		mockComment({ authorId: "author1", postId: "p1" });
		mockPost(PUBLIC_POST);
		const res = await PATCH(jsonReq("PATCH", { content: "edited" }), ctx("c1"));
		expect(res.status).toBe(200);
		expect(prisma.comment.update).toHaveBeenCalled();
	});
});
