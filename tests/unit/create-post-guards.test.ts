/**
 * Unit tests for createPost — the single guarded post-write path. Verifies the invariants
 * enforced at the choke point (INV-1/2/3/8): event-update XOR reply, one-level nesting,
 * page-post permission, and a reply adopting its parent's pageId regardless of client input.
 * Prisma, permission, and visibility are mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn(), create: vi.fn() },
    event: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn() }));
vi.mock("@/lib/utils/server/visibility", () => ({
  resolveParentVisibility: vi.fn().mockResolvedValue("LISTED"),
}));

import { createPost, PostInputError } from "@/lib/utils/server/post";
import { prisma } from "@/lib/utils/server/prisma";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { resolveParentVisibility } from "@/lib/utils/server/visibility";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.post.create).mockResolvedValue({ id: "new-post" } as never);
  vi.mocked(canPostAsPage).mockResolvedValue(true as never);
});

describe("createPost guards", () => {
  test("INV-1: rejects a post that is both an event update and a reply", async () => {
    await expect(
      createPost("u1", { content: "x", eventId: "e1", parentPostId: "p1" })
    ).rejects.toThrow(PostInputError);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  test("requires non-empty content unless isDraft", async () => {
    await expect(createPost("u1", { content: "   " })).rejects.toThrow(PostInputError);
    // draft may be empty
    await createPost("u1", { content: "", isDraft: true });
    expect(prisma.post.create).toHaveBeenCalledTimes(1);
  });

  test("INV-2: rejects a reply to a post that is already a reply (no nesting)", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      id: "p1", parentPostId: "grandparent", userId: "u1", pageId: null,
    } as never);
    await expect(createPost("u1", { content: "x", parentPostId: "p1" })).rejects.toThrow(
      /one level deep/
    );
  });

  test("INV-8: rejects a page post when the user lacks permission on the page", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(false as never);
    await expect(createPost("u1", { content: "x", pageId: "page-9" })).rejects.toThrow(
      /permission/i
    );
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  test("INV-3: a reply adopts its parent's pageId, ignoring the client-sent pageId", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      id: "p1", parentPostId: null, userId: "u1", pageId: "page-parent",
    } as never);
    await createPost("u1", { content: "x", parentPostId: "p1", pageId: "page-CLIENT-LIE" });
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pageId: "page-parent" }) })
    );
  });

  test("a reply derives visibility from its PARENT POST, not the page (matches the cascade)", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      id: "p1", parentPostId: null, userId: "u1", pageId: "page-parent",
    } as never);
    await createPost("u1", { content: "x", parentPostId: "p1" });
    // The parentPost branch must win — pageId/eventId are passed null so the parent post's
    // own stored visibility is inherited, even though the reply is written with the page's id.
    expect(resolveParentVisibility).toHaveBeenCalledWith("u1", null, null, "p1");
  });

  test("rejects an event update on an event the user does not own", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ userId: "someone-else" } as never);
    await expect(createPost("u1", { content: "x", eventId: "e1" })).rejects.toThrow(
      /don't own/
    );
  });

  test("a standalone post writes the client pageId null and derived visibility", async () => {
    await createPost("u1", { content: "hello" });
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pageId: null, contentVisibility: "LISTED" }),
      })
    );
  });
});
