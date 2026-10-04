/**
 * Route tests for PATCH /api/posts/[id] — the INV-3 wiring the unit tests for
 * syncDescendantVisibility don't cover:
 *  - a reply (parentPostId set) cannot have its pageId re-pointed → 400, no write.
 *  - re-parenting a top-level post cascades the new pageId to its replies AND runs the
 *    POST-type visibility cascade, both inside the transaction.
 * Prisma, visibility, and permission helpers are mocked — no DB needed.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const tx = {
  post: {
    update: vi.fn().mockResolvedValue({ id: "post-1" }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    post: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
  },
}));
vi.mock("@/lib/utils/server/permission", () => ({
  canPostAsPage: vi.fn(),
  canPostToPage: vi.fn().mockResolvedValue(true),
  canEditContent: vi.fn().mockResolvedValue(true),
  canModerateContent: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/utils/server/user", () => ({ publicUserEmbedFields: {} }));
vi.mock("@/lib/utils/server/visibility", () => ({
  getViewerContext: vi.fn(),
  canViewPost: vi.fn().mockResolvedValue(true),
  isContentOwner: vi.fn().mockResolvedValue(true),
  requireViewablePost: vi.fn(),
  resolveParentVisibility: vi.fn().mockResolvedValue("PRIVATE"),
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
import { getViewerContext, requireViewablePost, syncDescendantVisibility } from "@/lib/utils/server/visibility";
import { canEditContent, canPostAsPage } from "@/lib/utils/server/permission";

const patch = (id: string, body: unknown) => {
  const req = new Request(`http://localhost/api/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.post.update.mockResolvedValue({ id: "post-1" });
  tx.post.updateMany.mockResolvedValue({ count: 1 });
  vi.mocked(getViewerContext).mockResolvedValue({ userId: "u1" } as never);
  vi.mocked(canPostAsPage).mockResolvedValue(true as never);
  vi.mocked(canEditContent).mockResolvedValue(true);
});

describe("PATCH /api/posts/[id] — INV-3 re-parent wiring", () => {
  test("a reply cannot be re-pointed to a different page → 400, no write", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "reply-1", userId: "u1", pageId: "page-A", eventId: null,
      parentPostId: "parent-1", status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    const res = await patch("reply-1", { pageId: "page-B" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/reply inherits its page/i) });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("a published post's placement can't change", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: "page-A", eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    const res = await patch("post-1", { pageId: "page-B" });
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("re-parenting a DRAFT cascades pageId to replies AND runs the POST visibility cascade", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: null, showOnAuthorProfile: false, eventId: null,
      parentPostId: null, status: "DRAFT", contentVisibility: "LISTED",
    } as never);
    const res = await patch("post-1", { pageId: "page-B" });
    expect(res.status).toBe(200);
    // pageId cascade to the post's replies, with the NEW page
    expect(tx.post.updateMany).toHaveBeenCalledWith({
      where: { parentPostId: "post-1" },
      data: { pageId: "page-B", asPageId: null, showOnAuthorProfile: false },
    });
    // visibility cascade for replies, using the POST parent type + the tx client
    expect(syncDescendantVisibility).toHaveBeenCalledWith("POST", "post-1", "PRIVATE", tx);
  });

  test("a page manager can pin a member post without being able to edit it", async () => {
    vi.mocked(canEditContent).mockResolvedValue(false);
    vi.mocked(canPostAsPage).mockResolvedValue(true);
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "alice", pageId: "page-A", asPageId: null, eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    const res = await patch("post-1", { pinnedAt: "2026-10-03T00:00:00.000Z" });
    expect(res.status).toBe(200);
  });

  test("a page manager cannot edit a member post's words", async () => {
    vi.mocked(canEditContent).mockResolvedValue(false);
    vi.mocked(canPostAsPage).mockResolvedValue(true);
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "alice", pageId: "page-A", asPageId: null, eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    const res = await patch("post-1", { content: "rewritten" });
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("switching a draft's voice on the same page updates replies and does not re-derive visibility", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: "page-A", showOnAuthorProfile: false, eventId: null,
      parentPostId: null, status: "DRAFT", contentVisibility: "LISTED",
    } as never);
    const res = await patch("post-1", { asPageId: null, showOnAuthorProfile: true });
    expect(res.status).toBe(200);
    expect(tx.post.updateMany).toHaveBeenCalledWith({
      where: { parentPostId: "post-1" },
      data: { pageId: "page-A", asPageId: null, showOnAuthorProfile: true },
    });
    expect(syncDescendantVisibility).not.toHaveBeenCalled();
  });

  test("an event update's placement cannot change", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: null, asPageId: null, eventId: "e1",
      parentPostId: null, status: "DRAFT", contentVisibility: "PRIVATE",
    } as never);
    const res = await patch("post-1", { pageId: "public-page" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/event update/i) });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("the author cannot unpin a page post", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(false);
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: null, eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    const res = await patch("post-1", { pinnedAt: null });
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("editing a reply's content (no pageId) is NOT blocked by the reply-page guard", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "reply-1", userId: "u1", pageId: "page-A", eventId: null,
      parentPostId: "parent-1", status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    const res = await patch("reply-1", { content: "edited" });
    expect(res.status).toBe(200);
    // no re-parent → no pageId cascade, no visibility cascade
    expect(tx.post.updateMany).not.toHaveBeenCalled();
    expect(syncDescendantVisibility).not.toHaveBeenCalled();
  });
});
