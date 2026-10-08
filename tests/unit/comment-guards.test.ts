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
    comment: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    handle: { findMany: vi.fn() },
    notification: { findMany: vi.fn() }, // already-tagged identities, read on edit
    post: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/permission", () => ({
  canPostAsPage: vi.fn(),
  canModerateContent: vi.fn(),
}));
vi.mock("@/lib/utils/server/activity", () => ({ emitActivity: vi.fn() }));
vi.mock("@/lib/utils/server/visibility", () => ({ isContentOwner: vi.fn() }));

import { createComment, updateComment, canModerateComment, canEditComment, CommentInputError } from "@/lib/utils/server/comment";
import { MAX_MENTION_NOTIFICATIONS } from "@/lib/utils/mentions";
import { validateCommentContent } from "@/lib/validations";
import { prisma } from "@/lib/utils/server/prisma";
import { canModerateContent, canPostAsPage } from "@/lib/utils/server/permission";
import { emitActivity } from "@/lib/utils/server/activity";
import type { ViewerContext } from "@/lib/utils/server/visibility";

const viewer = (userId: string | null): ViewerContext => ({ userId, memberPageIds: [] });

beforeEach(() => {
  vi.clearAllMocks();
  // create/update echo the written row back, the way the real select returns the stored content.
  vi.mocked(prisma.comment.create).mockImplementation((async ({ data }: any) => ({ id: "c1", ...data })) as never);
  vi.mocked(prisma.comment.update).mockImplementation((async ({ where, data }: any) => ({ id: where.id, ...data })) as never);
  vi.mocked(prisma.handle.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never);
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
      { type: "USER", id: "owner" },
      { type: "POST", id: "p1", commentId: "c1" },
      { authorUserId: "u1" }
    );
  });

  test("as-page comment targets the owning page and records the page as actor", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ userId: "owner", pageId: "host-page", asPageId: "host-page" } as never);
    await createComment("u1", { postId: "p1", asPageId: "my-page", content: "hi" });
    expect(emitActivity).toHaveBeenCalledWith(
      "comment.created",
      { type: "PAGE", id: "my-page" },
      { type: "PAGE", id: "host-page" },
      { type: "POST", id: "p1", commentId: "c1" },
      { authorUserId: "u1" } // so u1 isn't told about their own words if they also manage host-page
    );
  });
});

describe("@-mentions", () => {
  /** Handle rows the lookup resolves (anything not listed is an unknown handle). */
  function handles(rows: { handle: string; userId?: string; pageId?: string }[]) {
    vi.mocked(prisma.handle.findMany).mockResolvedValue(
      rows.map((r) => ({ handle: r.handle, userId: r.userId ?? null, pageId: r.pageId ?? null })) as never
    );
  }
  const calls = (action: string) => vi.mocked(emitActivity).mock.calls.filter((c) => c[0] === action);

  test("tags each real handle (user or page), bolds only those, ignores unknowns", async () => {
    handles([{ handle: "sam", userId: "sam-id" }, { handle: "workshop", pageId: "ws-page" }]);
    const item = await createComment("u1", { postId: "p1", content: "hi @Sam and @workshop, not @ghost" });

    expect(calls("comment.mentioned").map((c) => c[2])).toEqual([
      { type: "USER", id: "sam-id" },
      { type: "PAGE", id: "ws-page" },
    ]);
    expect(calls("comment.mentioned")[0][3]).toEqual({ type: "POST", id: "p1", commentId: "c1" });
    expect(item.mentions).toEqual(["sam", "workshop"]);
  });

  test("a tagged owner gets only the tag, not 'commented on your post'", async () => {
    handles([{ handle: "owner", userId: "owner" }]);
    await createComment("u1", { postId: "p1", content: "@owner look" });
    expect(calls("comment.mentioned")).toHaveLength(1);
    expect(calls("comment.created")).toHaveLength(0);
  });

  test("tagging yourself sends nothing; the owner still hears about the comment", async () => {
    handles([{ handle: "myself", userId: "u1" }]);
    await createComment("u1", { postId: "p1", content: "note to @myself" });
    expect(calls("comment.mentioned")).toHaveLength(0);
    expect(calls("comment.created")).toHaveLength(1);
  });

  test("one comment notifies at most MAX_MENTION_NOTIFICATIONS identities — the first ones named", async () => {
    const many = Array.from({ length: MAX_MENTION_NOTIFICATIONS + 5 }, (_, i) => ({ handle: `user${i}`, userId: `id${i}` }));
    handles([...many].reverse()); // the DB returns rows in its own order, not the text's
    await createComment("u1", { postId: "p1", content: many.map((m) => `@${m.handle}`).join(" ") });
    expect(calls("comment.mentioned").map((c) => c[2].id)).toEqual(
      many.slice(0, MAX_MENTION_NOTIFICATIONS).map((m) => m.userId)
    );
  });

  test("tagging the post's owning page gives its managers the tag, not 'commented on your post'", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ userId: "owner", pageId: "host-page", asPageId: "host-page" } as never);
    handles([{ handle: "host", pageId: "host-page" }]);
    await createComment("u1", { postId: "p1", content: "@host is this open saturday?" });
    expect(calls("comment.mentioned").map((c) => c[2])).toEqual([{ type: "PAGE", id: "host-page" }]);
    expect(calls("comment.created")).toHaveLength(0);
  });

  test("commenting as a page and tagging your own handle tells no one", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(true as never);
    handles([{ handle: "myself", userId: "u1" }]);
    await createComment("u1", { postId: "p1", asPageId: "my-page", content: "@myself will bring the saw" });
    expect(calls("comment.mentioned")).toHaveLength(0);
  });

  const editable = { id: "c1", authorId: "u1", asPageId: null, postId: "p1", eventId: null };

  test("an edit tags only identities not already told about this comment", async () => {
    handles([{ handle: "sam", userId: "sam-id" }, { handle: "alice", userId: "alice-id" }]);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([{ recipientUserId: "sam-id", contextPageId: null }] as never);
    const item = await updateComment(editable, "hey @sam and @alice");

    expect(calls("comment.mentioned").map((c) => c[2])).toEqual([{ type: "USER", id: "alice-id" }]);
    expect(calls("comment.created")).toHaveLength(0);
    expect(item.mentions).toEqual(["sam", "alice"]);
  });

  test("removing a tag and adding it back doesn't re-notify", async () => {
    handles([{ handle: "sam", userId: "sam-id" }]);
    // sam was told on the original comment; an edit dropped @sam, this edit puts it back.
    vi.mocked(prisma.notification.findMany).mockResolvedValue([{ recipientUserId: "sam-id", contextPageId: null }] as never);
    await updateComment(editable, "hey @sam again");
    expect(emitActivity).not.toHaveBeenCalled();
  });

  test("a page already tagged isn't re-tagged (its managers' rows collapse to the page)", async () => {
    handles([{ handle: "workshop", pageId: "ws-page" }]);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { recipientUserId: "admin", contextPageId: "ws-page" },
      { recipientUserId: "editor", contextPageId: "ws-page" },
    ] as never);
    await updateComment(editable, "ping @workshop");
    expect(emitActivity).not.toHaveBeenCalled();
  });

  test("edits share the comment's lifetime cap", async () => {
    const many = Array.from({ length: MAX_MENTION_NOTIFICATIONS + 5 }, (_, i) => ({ handle: `user${i}`, userId: `id${i}` }));
    handles(many);
    // 8 already told + 7 new handles in the text → only 2 more fit under the cap
    const alreadyTold = many.slice(0, MAX_MENTION_NOTIFICATIONS - 2).map((m) => ({ recipientUserId: m.userId, contextPageId: null }));
    vi.mocked(prisma.notification.findMany).mockResolvedValue(alreadyTold as never);
    await updateComment(editable, many.map((m) => `@${m.handle}`).join(" "));
    expect(calls("comment.mentioned")).toHaveLength(2);
  });
});

describe("canModerateComment", () => {
  const parent = { userId: "owner", pageId: null };

  test("the comment author may delete their own comment", async () => {
    const ok = await canModerateComment({ authorId: "u1" }, parent, viewer("u1"));
    expect(ok).toBe(true);
    expect(canModerateContent).not.toHaveBeenCalled();
  });

  test("the content owner may delete any comment", async () => {
    vi.mocked(canModerateContent).mockResolvedValue(true);
    const ok = await canModerateComment({ authorId: "someone" }, parent, viewer("owner"));
    expect(ok).toBe(true);
    expect(canModerateContent).toHaveBeenCalled();
  });

  test("a page manager may delete a member post's comment without being able to edit the post", async () => {
    vi.mocked(canModerateContent).mockResolvedValue(true);
    const memberPost = { userId: "alice", pageId: "page-1", asPageId: null };
    expect(await canModerateComment({ authorId: "someone" }, memberPost, viewer("editor"))).toBe(true);
  });

  test("an unrelated logged-in user may not delete", async () => {
    vi.mocked(canModerateContent).mockResolvedValue(false);
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
