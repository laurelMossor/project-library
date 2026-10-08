/**
 * getPostUpdates mirrors getEventUpdates: the owner sees DRAFT child updates,
 * everyone else is limited to PUBLISHED, and a viewer who can open an UNLISTED
 * parent still receives its updates. Prisma + permission are mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ContentVisibility } from "@prisma/client";
import type { ViewerContext } from "@/lib/utils/server/visibility";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    follow: { findFirst: vi.fn() },
    post: { findUnique: vi.fn(), findMany: vi.fn() },
    event: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({
  canEditContent: vi.fn(async (userId: string, content: { userId: string }) => content.userId === userId),
}));
vi.mock("@/lib/utils/server/image-attachment", () => ({ getImagesForTargetsBatch: vi.fn().mockResolvedValue(new Map()) }));

import { getPostUpdates } from "@/lib/utils/server/post";
import { prisma } from "@/lib/utils/server/prisma";

const OWNER: ViewerContext = { userId: "owner-1", memberPageIds: [] };
const STRANGER: ViewerContext = { userId: "viewer-9", memberPageIds: [] };

const seedParent = (contentVisibility: ContentVisibility) =>
  vi.mocked(prisma.post.findUnique).mockResolvedValue(
    {
      id: "p1",
      userId: "owner-1",
      pageId: null,
      asPageId: null,
      eventId: null,
      contentVisibility,
    } as never,
  );

const whereOf = () =>
  (vi.mocked(prisma.post.findMany).mock.calls[0]![0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
});

describe("getPostUpdates", () => {
  test("owner sees a draft update (no status filter)", async () => {
    seedParent(ContentVisibility.LISTED);
    await getPostUpdates("p1", OWNER);
    expect(whereOf().parentPostId).toBe("p1");
    expect(whereOf().status).toBeUndefined();
  });

  test("non-owner does not see draft updates", async () => {
    seedParent(ContentVisibility.LISTED);
    await getPostUpdates("p1", STRANGER);
    expect(whereOf().status).toBe("PUBLISHED");
  });

  test("a non-owner viewer gets the updates of an UNLISTED parent", async () => {
    seedParent(ContentVisibility.UNLISTED);
    await getPostUpdates("p1", STRANGER);
    expect(whereOf().parentPostId).toBe("p1");
    expect(whereOf().status).toBe("PUBLISHED");
    expect(whereOf().contentVisibility).toBeUndefined();
  });
});
