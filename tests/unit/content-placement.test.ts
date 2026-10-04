/**
 * Where a post lives vs who is speaking.
 * asPageId set → spoken as that page. pageId only → posted to that page, as the author.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/permission", () => ({
  canPostAsPage: vi.fn(),
  canPostToPage: vi.fn(),
}));

import { resolveContentPlacement, PlacementError } from "@/lib/utils/server/content-placement";
import { canPostAsPage, canPostToPage } from "@/lib/utils/server/permission";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(canPostAsPage).mockResolvedValue(true);
  vi.mocked(canPostToPage).mockResolvedValue(true);
});

describe("resolveContentPlacement", () => {
  test("speaking as a page lives on that page and not on the author's profile", async () => {
    const placement = await resolveContentPlacement("u1", { asPageId: "page-1", showOnAuthorProfile: true });
    expect(placement).toEqual({ pageId: "page-1", asPageId: "page-1", showOnAuthorProfile: false });
    expect(canPostAsPage).toHaveBeenCalledWith("u1", "page-1");
    expect(canPostToPage).not.toHaveBeenCalled();
  });

  test("posting to a page keeps the author's voice", async () => {
    const placement = await resolveContentPlacement("u1", { pageId: "page-1", showOnAuthorProfile: true });
    expect(placement).toEqual({ pageId: "page-1", asPageId: null, showOnAuthorProfile: true });
    expect(canPostToPage).toHaveBeenCalledWith("u1", "page-1");
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
    expect(canPostToPage).not.toHaveBeenCalled();
  });

  test("posting to a page that doesn't allow it throws", async () => {
    vi.mocked(canPostToPage).mockResolvedValue(false);
    await expect(resolveContentPlacement("u1", { pageId: "page-1" })).rejects.toBeInstanceOf(PlacementError);
  });
});
