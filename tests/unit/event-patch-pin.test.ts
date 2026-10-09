/**
 * updateEvent (src/lib/utils/server/event.ts) pin scope. Page pins count that page only.
 * Setting and clearing a pin both require a current editor.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const tx = {
  event: { update: vi.fn().mockResolvedValue({ id: "ev1" }) },
};

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    event: { findUnique: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    post: { count: vi.fn().mockResolvedValue(0) },
  },
}));
vi.mock("@/lib/utils/server/permission", () => ({
  canPostAsPage: vi.fn(),
  canEditContent: vi.fn().mockResolvedValue(true),
  canModerateContent: vi.fn(),
}));
vi.mock("@/lib/utils/server/visibility", () => ({
  canViewEvent: vi.fn(),
  isContentOwner: vi.fn(),
  requireViewableEvent: vi.fn(),
  resolveParentVisibility: vi.fn(),
  syncDescendantVisibility: vi.fn(),
}));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));

import { updateEvent } from "@/lib/utils/server/event";
import { prisma } from "@/lib/utils/server/prisma";
import { requireViewableEvent } from "@/lib/utils/server/visibility";
import { canPostAsPage } from "@/lib/utils/server/permission";

const patch = (data: Parameters<typeof updateEvent>[2]) => updateEvent({ userId: "member", memberPageIds: [] }, "ev1", data);

const event = {
  id: "ev1",
  userId: "member",
  pageId: "page-A",
  asPageId: null,
  showOnAuthorProfile: false,
  status: "PUBLISHED",
  contentVisibility: "LISTED",
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.event.update.mockResolvedValue({ id: "ev1" });
  vi.mocked(requireViewableEvent).mockResolvedValue(event as never);
  vi.mocked(prisma.event.count).mockResolvedValue(0);
});

describe("updateEvent pins", () => {
  test("a page pin counts only that page's pins", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(true);
    await patch({ pinnedAt: "2026-10-03T00:00:00.000Z" });
    expect(prisma.event.count).toHaveBeenCalledWith({
      where: {
        pageId: "page-A",
        pinnedAt: { not: null },
        id: { not: "ev1" },
      },
    });
    expect(tx.event.update).toHaveBeenCalled();
  });

  test("the author cannot unpin a page event", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(false);
    await expect(patch({ pinnedAt: null })).rejects.toMatchObject({ code: "forbidden" });
    expect(prisma.event.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("updateEvent field checks", () => {
  test("a bad timezone is refused before any write", async () => {
    await expect(patch({ eventTimezone: "Nope" })).rejects.toMatchObject({ code: "invalid" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
