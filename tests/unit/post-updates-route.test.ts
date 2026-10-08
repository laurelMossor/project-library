/**
 * GET /api/posts/[id]/posts runs the real parent gate. A private parent is 404
 * for a logged-in viewer with no relationship edge, same as opening the post.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    post: { findUnique: vi.fn(), findMany: vi.fn() },
    event: { findUnique: vi.fn() },
    permission: { findMany: vi.fn(), findFirst: vi.fn() },
    follow: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/image-attachment", () => ({
  getImagesForTargetsBatch: vi.fn().mockResolvedValue(new Map()),
  deleteAllAttachmentsForTarget: vi.fn(),
}));

import { GET } from "@/app/api/posts/[id]/posts/route";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.permission.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
});

describe("GET /api/posts/[id]/posts", () => {
  test("private parent + non-edge viewer → 404", async () => {
    vi.mocked(getSessionContext).mockResolvedValue({ userId: "stranger", activePageId: null } as never);
    vi.mocked(prisma.post.findUnique).mockResolvedValue({
      id: "p1",
      userId: "owner",
      pageId: null,
      asPageId: null,
      showOnAuthorProfile: false,
      eventId: null,
      parentPostId: null,
      status: "PUBLISHED",
      contentVisibility: "PRIVATE",
    } as never);

    const res = await GET(new Request("http://localhost/api/posts/p1/posts"), ctx("p1"));

    expect(res.status).toBe(404);
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});
