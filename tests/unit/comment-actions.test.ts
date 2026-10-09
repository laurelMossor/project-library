/**
 * Integration-style tests for the comment Server Actions — the feature's security boundary
 * that comment-guards.test.ts (which mocks the visibility layer) cannot cover.
 *
 * Design: mock ONLY the real seams — `prisma`, `getSessionContext`, and the Next request
 * plumbing (`headers`, `refresh`) — and let the genuine gate run: authedAction →
 * viewerContextFor → requireViewablePost/Event → canViewPost/Event → isContentOwner →
 * canActAsEntity → canPostAsPage → createComment → canModerateComment/canEditComment.
 * So a broken gate actually fails a test, rather than the test echoing a mocked verdict.
 * Rate limiting and activity are stubbed as orthogonal concerns.
 *
 * Listing comments is a server-page read (post/event detail pages) behind the parent's
 * own visibility gate, so it has no separate entry point to test here.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
	prisma: {
		post: { findUnique: vi.fn() },
		event: { findUnique: vi.fn() },
		permission: { findMany: vi.fn(), findFirst: vi.fn() },
		follow: { findFirst: vi.fn() },
		comment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn() },
		handle: { findMany: vi.fn() },
	},
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/rate-limit", () => ({ isRateLimited: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { addCommentAction, deleteCommentAction, editCommentAction } from "@/lib/actions/comment";
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
function mockComment(row: { authorId: string; postId?: string | null; eventId?: string | null; asPageId?: string | null }) {
	vi.mocked(prisma.comment.findUnique).mockResolvedValue({
		id: "c1", postId: null, eventId: null, asPageId: null, ...row,
	} as never);
}

const onPost = (content: string, asPageId?: string) => addCommentAction({ parent: { kind: "post", id: "p1" }, content, asPageId });

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never); // viewer manages no pages
	vi.mocked(prisma.permission.findFirst).mockResolvedValue(null as never); // no ADMIN/EDITOR
	vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never); // no follow edge
	vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);
	vi.mocked(prisma.comment.create).mockResolvedValue({ id: "c1", authorId: "owner", content: "hi" } as never);
	vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);
	vi.mocked(prisma.comment.update).mockResolvedValue({ id: "c1", content: "edited" } as never);
	vi.mocked(prisma.handle.findMany).mockResolvedValue([] as never);
});

const PUBLIC_POST: PostRow = { userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "LISTED" };

describe("addCommentAction — auth + parent gate", () => {
	test("anonymous → unauthorized (never reaches the parent)", async () => {
		asViewer(null);
		expect(await onPost("hi")).toMatchObject({ ok: false, error: "unauthorized" });
		expect(prisma.post.findUnique).not.toHaveBeenCalled();
	});

	test("PRIVATE parent, viewer has no follow edge → not_found (real edge check runs)", async () => {
		asViewer("stranger");
		mockPost({ userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "PRIVATE" });
		expect(await onPost("hi")).toMatchObject({ ok: false, error: "not_found" });
		expect(prisma.follow.findFirst).toHaveBeenCalled(); // the gate genuinely queried the edge
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});

	test("PRIVATE event parent → not_found (event branch)", async () => {
		asViewer("stranger");
		mockEvent({ userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "PRIVATE" });
		const result = await addCommentAction({ parent: { kind: "event", id: "e1" }, content: "hi" });
		expect(result).toMatchObject({ ok: false, error: "not_found" });
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});

	test("DRAFT parent, non-owner → not_found (real isContentOwner runs)", async () => {
		asViewer("stranger");
		mockPost({ userId: "owner", pageId: null, status: "DRAFT", contentVisibility: "LISTED" });
		expect(await onPost("hi")).toMatchObject({ ok: false, error: "not_found" });
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});

	test("owner comments on their own viewable post → ok", async () => {
		asViewer("owner");
		mockPost(PUBLIC_POST);
		expect(await onPost("hi")).toEqual({ ok: true, data: undefined });
		expect(prisma.comment.create).toHaveBeenCalled();
	});

	test("commenting as a page the viewer lacks ADMIN/EDITOR on → forbidden (real canPostAsPage)", async () => {
		asViewer("u1");
		mockPost(PUBLIC_POST); // parent viewable → forbidden (not not_found)
		vi.mocked(prisma.permission.findFirst).mockResolvedValue(null as never); // no manage role on the page
		expect(await onPost("hi", "page-x")).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});

	test("an empty comment → invalid", async () => {
		asViewer("owner");
		mockPost(PUBLIC_POST);
		expect(await onPost("   ")).toMatchObject({ ok: false, error: "invalid" });
		expect(prisma.comment.create).not.toHaveBeenCalled();
	});
});

describe("deleteCommentAction — 404-before-403, then moderation authz", () => {
	test("parent unviewable → not_found (hidden parent can't be probed via its comment)", async () => {
		asViewer("stranger");
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost({ userId: "owner", pageId: null, status: "PUBLISHED", contentVisibility: "PRIVATE" });
		expect(await deleteCommentAction({ id: "c1" })).toMatchObject({ ok: false, error: "not_found" });
		expect(prisma.comment.delete).not.toHaveBeenCalled();
	});

	test("viewable parent, unrelated viewer → forbidden", async () => {
		asViewer("stranger");
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost(PUBLIC_POST);
		expect(await deleteCommentAction({ id: "c1" })).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.comment.delete).not.toHaveBeenCalled();
	});

	test("content owner may delete someone else's comment → ok", async () => {
		asViewer("owner");
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost(PUBLIC_POST); // post.userId === "owner"
		expect(await deleteCommentAction({ id: "c1" })).toMatchObject({ ok: true });
		expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
	});

	test("author may delete their own comment → ok", async () => {
		asViewer("author1");
		mockComment({ authorId: "author1", postId: "p1" });
		mockPost(PUBLIC_POST); // author1 is not the post owner
		expect(await deleteCommentAction({ id: "c1" })).toMatchObject({ ok: true });
		expect(prisma.comment.delete).toHaveBeenCalled();
	});
});

describe("editCommentAction — author-only edit (distinct from moderation)", () => {
	test("a content owner who is NOT the author cannot edit → forbidden", async () => {
		asViewer("owner"); // owns the post, but didn't write the comment
		mockComment({ authorId: "someone", postId: "p1" });
		mockPost(PUBLIC_POST);
		expect(await editCommentAction({ id: "c1", content: "rewrite" })).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.comment.update).not.toHaveBeenCalled();
	});

	test("the author may edit their own comment → ok", async () => {
		asViewer("author1");
		mockComment({ authorId: "author1", postId: "p1" });
		mockPost(PUBLIC_POST);
		expect(await editCommentAction({ id: "c1", content: "edited" })).toMatchObject({ ok: true });
		expect(prisma.comment.update).toHaveBeenCalled();
	});

	test("the author of an as-page comment who no longer manages the page cannot edit → forbidden", async () => {
		asViewer("author1");
		mockComment({ authorId: "author1", postId: "p1", asPageId: "page-1" });
		mockPost(PUBLIC_POST);
		// beforeEach: permission.findFirst → null, i.e. no ADMIN/EDITOR row on page-1 anymore
		expect(await editCommentAction({ id: "c1", content: "rewrite as the page" })).toMatchObject({ ok: false, error: "forbidden" });
		expect(prisma.comment.update).not.toHaveBeenCalled();
	});

	test("a current editor may still edit their as-page comment → ok", async () => {
		asViewer("author1");
		mockComment({ authorId: "author1", postId: "p1", asPageId: "page-1" });
		mockPost(PUBLIC_POST);
		vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: "EDITOR" } as never);
		expect(await editCommentAction({ id: "c1", content: "edited" })).toMatchObject({ ok: true });
		expect(prisma.comment.update).toHaveBeenCalled();
	});
});
