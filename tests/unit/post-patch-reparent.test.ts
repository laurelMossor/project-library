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
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn() }));
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
import { canPostAsPage } from "@/lib/utils/server/permission";

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

  test("re-parenting a top-level post cascades pageId to replies AND runs the POST visibility cascade", async () => {
    vi.mocked(requireViewablePost).mockResolvedValue({
      id: "post-1", userId: "u1", pageId: "page-A", eventId: null,
      parentPostId: null, status: "PUBLISHED", contentVisibility: "LISTED",
    } as never);
    const res = await patch("post-1", { pageId: "page-B" });
    expect(res.status).toBe(200);
    // pageId cascade to the post's replies, with the NEW page
    expect(tx.post.updateMany).toHaveBeenCalledWith({
      where: { parentPostId: "post-1" },
      data: { pageId: "page-B" },
    });
    // visibility cascade for replies, using the POST parent type + the tx client
    expect(syncDescendantVisibility).toHaveBeenCalledWith("POST", "post-1", "PRIVATE", tx);
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
