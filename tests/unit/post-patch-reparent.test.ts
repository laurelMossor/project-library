/**
 * updatePost (src/lib/utils/server/post.ts) — the INV-3 wiring the unit tests for
 * syncDescendantVisibility don't cover:
 *  - a reply (parentPostId set) cannot have its pageId re-pointed → invalid, no write.
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
    event: { count: vi.fn().mockResolvedValue(0) },
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
  canViewPost: vi.fn().mockResolvedValue(true),
  isContentOwner: vi.fn().mockResolvedValue(true),
  requireViewablePost: vi.fn(),
  resolveParentVisibility: vi.fn().mockResolvedValue("PRIVATE"),
  syncDescendantVisibility: vi.fn(),
}));

import { updatePost } from "@/lib/utils/server/post";
import { prisma } from "@/lib/utils/server/prisma";
import { requireViewablePost, syncDescendantVisibility } from "@/lib/utils/server/visibility";
import { canEditContent, canPostAsPage } from "@/lib/utils/server/permission";

const viewer = { userId: "u1", memberPageIds: [] };
const patch = (id: string, data: Parameters<typeof updatePost>[2]) => updatePost(viewer, id, data);

beforeEach(() => {
  vi.clearAllMocks();
  tx.post.update.mockResolvedValue({ id: "post-1" });
  tx.post.updateMany.mockResolvedValue({ count: 1 });
  vi.mocked(canPostAsPage).mockResolvedValue(true as never);
  vi.mocked(canEditContent).mockResolvedValue(true);
});

describe("updatePost — INV-3 re-parent wiring", () => {
  test("a reply cannot be re-pointed to a different page → invalid, no write", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "reply-1", userId: "u1", pageId: "page-A", eventId: null,
      parentPostId: "parent-1", status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    await expect(patch("reply-1", { pageId: "page-B" })).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringMatching(/reply inherits its page/i),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("a published post's placement can't change", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: "page-A", eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    await expect(patch("post-1", { pageId: "page-B" })).rejects.toMatchObject({ code: "invalid" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("re-parenting a DRAFT cascades pageId to replies AND runs the POST visibility cascade", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: null, showOnAuthorProfile: false, eventId: null,
      parentPostId: null, status: "DRAFT", contentVisibility: "LISTED",
    } as never);
    await patch("post-1", { pageId: "page-B" });
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
    await expect(patch("post-1", { pinnedAt: "2026-10-03T00:00:00.000Z" })).resolves.toBeUndefined();
  });

  test("a page manager cannot edit a member post's words", async () => {
    vi.mocked(canEditContent).mockResolvedValue(false);
    vi.mocked(canPostAsPage).mockResolvedValue(true);
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "alice", pageId: "page-A", asPageId: null, eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    await expect(patch("post-1", { content: "rewritten" })).rejects.toMatchObject({ code: "forbidden" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("switching a draft's voice on the same page updates replies and does not re-derive visibility", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: "page-A", showOnAuthorProfile: false, eventId: null,
      parentPostId: null, status: "DRAFT", contentVisibility: "LISTED",
    } as never);
    await patch("post-1", { asPageId: null, showOnAuthorProfile: true });
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
    await expect(patch("post-1", { pageId: "public-page" })).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringMatching(/event update/i),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("the author cannot unpin a page post", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(false);
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", asPageId: null, eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    await expect(patch("post-1", { pinnedAt: null })).rejects.toMatchObject({ code: "forbidden" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("editing a reply's content (no pageId) is NOT blocked by the reply-page guard", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "reply-1", userId: "u1", pageId: "page-A", eventId: null,
      parentPostId: "parent-1", status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    await patch("reply-1", { content: "edited" });
    // no re-parent → no pageId cascade, no visibility cascade
    expect(tx.post.updateMany).not.toHaveBeenCalled();
    expect(syncDescendantVisibility).not.toHaveBeenCalled();
  });

  test("a post the viewer can't see → not_found, never a forbidden that confirms it exists", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue(null);
    await expect(patch("hidden", { content: "x" })).rejects.toMatchObject({ code: "not_found" });
  });
});
