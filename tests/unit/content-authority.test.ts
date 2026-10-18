/**
 * Edit vs moderate. A page editor can delete a member's post to the page
 * and cannot rewrite it. They can edit a post spoken as the page.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    permission: { findFirst: vi.fn() },
  },
}));

import { canEditContent, canModerateContent } from "@/lib/utils/server/permission";
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
});
