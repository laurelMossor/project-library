/**
 * Unit tests for the comment server layer:
 * - createComment guards (exactly-one target, non-empty content, as-page permission) + the
 *   activity seam firing once on success.
 * - canModerateComment (author / content-owner / stranger / anon).
 * - validateCommentContent.
 * Prisma, permission, activity, and visibility are mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    comment: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    post: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/permission", () => ({ canPostAsPage: vi.fn() }));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("@/lib/utils/server/visibility", () => ({ isContentOwner: vi.fn() }));

import { createComment, canModerateComment, canEditComment, CommentInputError } from "@/lib/utils/server/comment";
import { validateCommentContent } from "@/lib/validations";
import { prisma } from "@/lib/utils/server/prisma";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { emitActivity } from "@/lib/utils/server/activity";
import { isContentOwner } from "@/lib/utils/server/visibility";
import type { ViewerContext } from "@/lib/utils/server/visibility";

const viewer = (userId: string | null): ViewerContext => ({ userId, memberPageIds: [] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.comment.create).mockResolvedValue({ id: "c1", authorId: "u1" } as never);
  vi.mocked(prisma.post.findUnique).mockResolvedValue({ userId: "owner", pageId: null } as never);
  vi.mocked(canPostAsPage).mockResolvedValue(true as never);
});

describe("createComment guards", () => {
  test("rejects a comment targeting both a post and an event", async () => {
    await expect(
      createComment("u1", { postId: "p1", eventId: "e1", content: "hi" })
    ).rejects.toThrow(CommentInputError);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  test("rejects a comment targeting neither a post nor an event", async () => {
    await expect(createComment("u1", { content: "hi" })).rejects.toThrow(CommentInputError);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  test("rejects empty / whitespace-only content", async () => {
    await expect(createComment("u1", { postId: "p1", content: "   " })).rejects.toThrow(
      CommentInputError
    );
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  test("rejects commenting as a page the user cannot post as", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(false as never);
    await expect(
      createComment("u1", { postId: "p1", asPageId: "page-9", content: "hi" })
    ).rejects.toThrow(/permission/i);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  test("creates a post comment and fires the activity seam once", async () => {
    await createComment("u1", { postId: "p1", content: "  hi  " });
    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ postId: "p1", content: "hi" }) })
    );
    expect(emitActivity).toHaveBeenCalledTimes(1);
    expect(emitActivity).toHaveBeenCalledWith(
      "comment.created",
      { type: "USER", id: "u1" },
      { type: "USER", id: "owner" }
    );
  });

  test("as-page comment targets the owning page and records the page as actor", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ userId: "owner", pageId: "host-page" } as never);
    await createComment("u1", { postId: "p1", asPageId: "my-page", content: "hi" });
    expect(emitActivity).toHaveBeenCalledWith(
      "comment.created",
      { type: "PAGE", id: "my-page" },
      { type: "PAGE", id: "host-page" }
    );
  });
});

describe("canModerateComment", () => {
  const parent = { userId: "owner", pageId: null };

  test("the comment author may delete their own comment", async () => {
    const ok = await canModerateComment({ authorId: "u1" }, parent, viewer("u1"));
    expect(ok).toBe(true);
    expect(isContentOwner).not.toHaveBeenCalled();
  });

  test("the content owner may delete any comment", async () => {
    vi.mocked(isContentOwner).mockResolvedValue(true as never);
    const ok = await canModerateComment({ authorId: "someone" }, parent, viewer("owner"));
    expect(ok).toBe(true);
  });

  test("an unrelated logged-in user may not delete", async () => {
    vi.mocked(isContentOwner).mockResolvedValue(false as never);
    const ok = await canModerateComment({ authorId: "someone" }, parent, viewer("stranger"));
    expect(ok).toBe(false);
  });

  test("an anonymous viewer may not delete", async () => {
    const ok = await canModerateComment({ authorId: "someone" }, parent, viewer(null));
    expect(ok).toBe(false);
  });
});

describe("canEditComment", () => {
	test("only the author may edit (not a content owner, not anon)", () => {
		expect(canEditComment({ authorId: "u1" }, viewer("u1"))).toBe(true);
		expect(canEditComment({ authorId: "u1" }, viewer("owner"))).toBe(false);
		expect(canEditComment({ authorId: "u1" }, viewer(null))).toBe(false);
	});
});

describe("validateCommentContent", () => {
  test("rejects empty and whitespace-only", () => {
    expect(validateCommentContent("").valid).toBe(false);
    expect(validateCommentContent("   ").valid).toBe(false);
  });

  test("rejects content over 5000 characters", () => {
    expect(validateCommentContent("a".repeat(5001)).valid).toBe(false);
  });

  test("accepts normal content", () => {
    expect(validateCommentContent("Looks great!").valid).toBe(true);
  });
});
