/**
 * Unit test for getEventUpdates DRAFT filtering (finding 4): only the event owner (author or page
 * manager) sees DRAFT child update posts; every other viewer is limited to PUBLISHED, so a
 * published event's unfinished draft update can't leak through GET /api/events/[id]/posts.
 * Prisma + permission + session are mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ContentVisibility } from "@prisma/client";
import type { ViewerContext } from "@/lib/utils/server/visibility";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    follow: { findFirst: vi.fn() },
    event: { findUnique: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({ canActAsEntity: vi.fn() }));
vi.mock("@/lib/utils/server/image-attachment", () => ({ getImagesForTargetsBatch: vi.fn().mockResolvedValue(new Map()) }));

import { getEventUpdates } from "@/lib/utils/server/post";
import { prisma } from "@/lib/utils/server/prisma";
import { canActAsEntity } from "@/lib/utils/server/permission";

const OWNER: ViewerContext = { userId: "owner-1", memberPageIds: [] };
const STRANGER: ViewerContext = { userId: "viewer-9", memberPageIds: [] };

// A standalone (no page) LISTED event owned by owner-1.
const seedEvent = () =>
  vi.mocked(prisma.event.findUnique).mockResolvedValue(
    { id: "e1", userId: "owner-1", pageId: null, contentVisibility: ContentVisibility.LISTED } as never,
  );

const whereOf = () =>
  (vi.mocked(prisma.post.findMany).mock.calls[0]![0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
  vi.mocked(canActAsEntity).mockResolvedValue(false);
  vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
  seedEvent();
});

describe("getEventUpdates DRAFT filter", () => {
  test("non-owner viewer → PUBLISHED-only filter is applied", async () => {
    await getEventUpdates("e1", STRANGER);
    expect(whereOf().status).toBe("PUBLISHED");
  });

  test("owner viewer → no status filter (owner sees their own drafts)", async () => {
    await getEventUpdates("e1", OWNER);
    expect(whereOf().status).toBeUndefined();
  });
});
