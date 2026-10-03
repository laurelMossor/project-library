/**
 * A to-page post on its author's profile is never wider than it is on the page.
 * Following the author is not enough to see a private page's member post.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { follow: { findMany: vi.fn() } },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));

import { authorProfilePlacementWhere } from "@/lib/utils/server/visibility";
import { prisma } from "@/lib/utils/server/prisma";
import type { ViewerContext } from "@/lib/utils/server/visibility";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.follow.findMany).mockResolvedValue([]);
});

describe("authorProfilePlacementWhere", () => {
  test("a follower of the author, not of the page, only gets the public-page branch", async () => {
    const viewer: ViewerContext = { userId: "follower", memberPageIds: [] };
    const where = await authorProfilePlacementWhere(viewer) as {
      asPageId: null;
      showOnAuthorProfile: boolean;
      OR: Array<Record<string, unknown>>;
    };
    expect(where.asPageId).toBeNull();
    expect(where.showOnAuthorProfile).toBe(true);
    expect(where.OR).toEqual([
      {
        contentVisibility: { not: "PRIVATE" },
        page: {
          profileVisibility: "PUBLIC",
          contentVisibility: { not: "PRIVATE" },
        },
      },
    ]);
  });

  test("a page member can see that page's member posts on the author's profile", async () => {
    const viewer: ViewerContext = { userId: "member", memberPageIds: ["secret"] };
    const where = await authorProfilePlacementWhere(viewer) as { OR: Array<Record<string, unknown>> };
    expect(where.OR).toContainEqual({ pageId: { in: ["secret"] } });
  });
});
