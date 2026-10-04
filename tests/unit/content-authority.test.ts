/**
 * Edit vs moderate. A page editor can delete a member's post to the page
 * and cannot rewrite it. They can edit a post spoken as the page.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    permission: { findFirst: vi.fn(), findUnique: vi.fn() },
    page: { findUnique: vi.fn() },
  },
}));

import { canEditContent, canModerateContent, canPostToPage } from "@/lib/utils/server/permission";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => vi.clearAllMocks());

describe("content authority", () => {
  const memberPost = { userId: "alice", pageId: "page-1", asPageId: null };
  const asPagePost = { userId: "alice", pageId: "page-1", asPageId: "page-1" };

  test("the author can edit; a page editor cannot edit a member post", async () => {
    expect(await canEditContent("alice", memberPost)).toBe(true);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canEditContent("editor", memberPost)).toBe(false);
  });

  test("page-spoken content requires a current editor, not the original author", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canEditContent("alice", asPagePost)).toBe(false);
    vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: "EDITOR" } as never);
    expect(await canEditContent("alice", asPagePost)).toBe(true);
  });

  test("a page editor can edit a post spoken as the page, and can delete a member post", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue({ role: "EDITOR" } as never);
    expect(await canEditContent("editor", asPagePost)).toBe(true);
    expect(await canModerateContent("editor", memberPost)).toBe(true);
  });

  test("canPostToPage requires the page to allow member posts and any role", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ allowMemberPosts: false } as never);
    expect(await canPostToPage("alice", "page-1")).toBe(false);

    vi.mocked(prisma.page.findUnique).mockResolvedValue({ allowMemberPosts: true } as never);
    vi.mocked(prisma.permission.findUnique).mockResolvedValue(null);
    expect(await canPostToPage("alice", "page-1")).toBe(false);

    vi.mocked(prisma.permission.findUnique).mockResolvedValue({ role: "MEMBER" } as never);
    expect(await canPostToPage("alice", "page-1")).toBe(true);
  });
});
