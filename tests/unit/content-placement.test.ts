/**
 * Where a post lives vs who is speaking.
 * asPageId set → spoken as that page. pageId only → posted to that page, as the author.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/permission", () => ({
  canPostAsPage: vi.fn(),
  getUserPermission: vi.fn(),
}));
vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { page: { findUnique: vi.fn() } },
}));

import { resolveContentPlacement, PlacementError } from "@/lib/utils/server/content-placement";
import { canPostAsPage, getUserPermission } from "@/lib/utils/server/permission";
import { prisma } from "@/lib/utils/server/prisma";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(canPostAsPage).mockResolvedValue(true);
  vi.mocked(getUserPermission).mockResolvedValue("MEMBER");
  vi.mocked(prisma.page.findUnique).mockResolvedValue({ allowMemberPosts: true } as never);
});

describe("resolveContentPlacement", () => {
  test("speaking as a page lives on that page and not on the author's profile", async () => {
    const placement = await resolveContentPlacement("u1", { asPageId: "page-1", showOnAuthorProfile: true });
    expect(placement).toEqual({ pageId: "page-1", asPageId: "page-1", showOnAuthorProfile: false });
    expect(canPostAsPage).toHaveBeenCalledWith("u1", "page-1");
    expect(getUserPermission).not.toHaveBeenCalled();
  });

  test("posting to a page keeps the author's voice", async () => {
    const placement = await resolveContentPlacement("u1", { pageId: "page-1", showOnAuthorProfile: true });
    expect(placement).toEqual({ pageId: "page-1", asPageId: null, showOnAuthorProfile: true });
    expect(getUserPermission).toHaveBeenCalledWith("u1", "page-1", "PAGE");
  });

  test("no page → a personal post", async () => {
    expect(await resolveContentPlacement("u1", {})).toEqual({
      pageId: null,
      asPageId: null,
      showOnAuthorProfile: false,
    });
  });

  test("a reply copies its parent's placement", async () => {
    const parent = { pageId: "page-1", asPageId: null, showOnAuthorProfile: true };
    expect(await resolveContentPlacement("u1", { parent, pageId: "other" })).toEqual(parent);
    expect(getUserPermission).not.toHaveBeenCalled();
  });

  test("a member can't post to a page that has member posts off", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ allowMemberPosts: false } as never);
    await expect(resolveContentPlacement("u1", { pageId: "page-1" })).rejects.toBeInstanceOf(PlacementError);
  });

  test("someone with no role can't post to a page, even one with member posts on", async () => {
    vi.mocked(getUserPermission).mockResolvedValue(null);
    await expect(resolveContentPlacement("u1", { pageId: "page-1" })).rejects.toBeInstanceOf(PlacementError);
  });

  test("admins and editors can post to their page with member posts off", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ allowMemberPosts: false } as never);
    for (const role of ["ADMIN", "EDITOR"] as const) {
      vi.mocked(getUserPermission).mockResolvedValue(role);
      expect(await resolveContentPlacement("u1", { pageId: "page-1" })).toEqual({
        pageId: "page-1",
        asPageId: null,
        showOnAuthorProfile: false,
      });
    }
  });
});
