/**
 * PATCH /api/events/:id pin scope. Page pins count that page only.
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
  getViewerContext: vi.fn(),
  canViewEvent: vi.fn(),
  isContentOwner: vi.fn(),
  requireViewableEvent: vi.fn(),
  resolveParentVisibility: vi.fn(),
  syncDescendantVisibility: vi.fn(),
}));
vi.mock("@/lib/utils/server/image-attachment", () => ({
  getImagesForTarget: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/utils/errors", () => ({
  unauthorized: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
  notFound: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 404 }),
  serverError: () => new Response(JSON.stringify({ error: "err" }), { status: 500 }),
}));

import { PATCH } from "@/app/api/events/[id]/route";
import { prisma } from "@/lib/utils/server/prisma";
import { getViewerContext, requireViewableEvent } from "@/lib/utils/server/visibility";
import { canPostAsPage } from "@/lib/utils/server/permission";

const patch = (body: unknown) => {
  const req = new Request("http://localhost/api/events/ev1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: "ev1" }) });
};

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
  vi.mocked(getViewerContext).mockResolvedValue({ userId: "member" } as never);
  vi.mocked(requireViewableEvent).mockResolvedValue(event as never);
  vi.mocked(prisma.event.count).mockResolvedValue(0);
});

describe("PATCH /api/events/:id pins", () => {
  test("a page pin counts only that page's pins", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(true);
    const res = await patch({ pinnedAt: "2026-10-03T00:00:00.000Z" });
    expect(res.status).toBe(200);
    expect(prisma.event.count).toHaveBeenCalledWith({
      where: {
        pageId: "page-A",
        pinnedAt: { not: null },
        id: { not: "ev1" },
      },
    });
  });

  test("the author cannot unpin a page event", async () => {
    vi.mocked(canPostAsPage).mockResolvedValue(false);
    const res = await patch({ pinnedAt: null });
    expect(res.status).toBe(400);
    expect(prisma.event.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
