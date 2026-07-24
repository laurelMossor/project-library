/**
 * Unit tests for requireViewableEvent / requireViewablePost — the centralized fetch+gate for the
 * event/post detail & mutation routes. Covers the DRAFT-owner rule (author OR page co-manager —
 * finding 8), the PRIVATE content gate, and the missing→null (404) behavior. Prisma and the
 * permission layer are mocked so no DB/auth is required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ContentVisibility } from "@prisma/client";
import type { ViewerContext } from "@/lib/utils/server/visibility";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    follow: { findFirst: vi.fn() },
    event: { findUnique: vi.fn() },
    post: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/utils/server/permission", () => ({ canActAsEntity: vi.fn() }));

import { requireViewableEvent, requireViewablePost } from "@/lib/utils/server/visibility";
import { prisma } from "@/lib/utils/server/prisma";
import { canActAsEntity } from "@/lib/utils/server/permission";

const ANON: ViewerContext = { userId: null, memberPageIds: [] };
const AUTHOR: ViewerContext = { userId: "owner-1", memberPageIds: [] };
const STRANGER: ViewerContext = { userId: "viewer-9", memberPageIds: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
  vi.mocked(canActAsEntity).mockResolvedValue(false);
});

describe("requireViewableEvent", () => {
  const event = (over: Partial<Record<string, unknown>> = {}) =>
    ({ id: "e1", userId: "owner-1", pageId: null, status: "PUBLISHED", contentVisibility: ContentVisibility.LISTED, ...over });

  test("missing event → null (404)", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null as never);
    expect(await requireViewableEvent("e1", ANON)).toBeNull();
  });

  test("published LISTED → visible to anyone", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(event() as never);
    expect(await requireViewableEvent("e1", ANON)).not.toBeNull();
  });

  test("DRAFT → visible to its author, null for a stranger", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(event({ status: "DRAFT" }) as never);
    expect(await requireViewableEvent("e1", AUTHOR)).not.toBeNull();
    expect(await requireViewableEvent("e1", STRANGER)).toBeNull();
    expect(await requireViewableEvent("e1", ANON)).toBeNull();
  });

  test("DRAFT page event → a page co-manager (ADMIN/EDITOR) may see it (finding 8)", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(event({ status: "DRAFT", pageId: "page-1", userId: "someone-else" }) as never);
    vi.mocked(canActAsEntity).mockResolvedValue(true);
    expect(await requireViewableEvent("e1", STRANGER)).not.toBeNull();
    expect(canActAsEntity).toHaveBeenCalledWith("viewer-9", { page: { id: "page-1" } });
  });

  test("published PRIVATE → null for a non-edge viewer, event for the owner", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(event({ contentVisibility: ContentVisibility.PRIVATE }) as never);
    expect(await requireViewableEvent("e1", STRANGER)).toBeNull();
    expect(await requireViewableEvent("e1", AUTHOR)).not.toBeNull();
  });
});

describe("requireViewablePost", () => {
  const post = (over: Partial<Record<string, unknown>> = {}) =>
    ({ id: "p1", userId: "owner-1", pageId: null, eventId: null, status: "PUBLISHED", contentVisibility: ContentVisibility.LISTED, ...over });

  test("missing post → null (404)", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(null as never);
    expect(await requireViewablePost("p1", ANON)).toBeNull();
  });

  test("DRAFT → author yes, stranger null", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(post({ status: "DRAFT" }) as never);
    expect(await requireViewablePost("p1", AUTHOR)).not.toBeNull();
    expect(await requireViewablePost("p1", STRANGER)).toBeNull();
  });

  test("published PRIVATE standalone → null for a stranger, post for the author", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue(post({ contentVisibility: ContentVisibility.PRIVATE }) as never);
    expect(await requireViewablePost("p1", STRANGER)).toBeNull();
    expect(await requireViewablePost("p1", AUTHOR)).not.toBeNull();
  });
});
