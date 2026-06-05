/**
 * Visibility helper unit tests — canViewUser, canViewPage, canViewEvent, canViewPost,
 * listVisibilityWhere helpers.
 *
 * Prisma is mocked so no DB connection is required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { Visibility } from "@prisma/client";
import type { ViewerContext } from "@/lib/utils/server/visibility";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    follow: { findFirst: vi.fn() },
    permission: { findMany: vi.fn() },
    event: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/utils/server/session", () => ({
  getSessionContext: vi.fn(),
}));

import {
  canViewUser,
  canViewPage,
  canViewEvent,
  canViewPost,
  userListWhere,
  pageListWhere,
  eventListWhere,
  postListWhere,
} from "@/lib/utils/server/visibility";
import { prisma } from "@/lib/utils/server/prisma";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ANON: ViewerContext = { userId: null, memberPageIds: [] };
const VIEWER: ViewerContext = { userId: "viewer-1", memberPageIds: [] };
const MEMBER: ViewerContext = { userId: "viewer-1", memberPageIds: ["page-1"] };
const OWNER: ViewerContext = { userId: "owner-1", memberPageIds: [] };

// ── canViewUser ───────────────────────────────────────────────────────────────

describe("canViewUser", () => {
  beforeEach(() => vi.clearAllMocks());

  test("PUBLIC user → visible to anyone (anon)", async () => {
    const user = { id: "owner-1", visibility: Visibility.PUBLIC };
    expect(await canViewUser(user, ANON)).toBe(true);
  });

  test("UNLISTED user → visible to anyone (anon)", async () => {
    const user = { id: "owner-1", visibility: Visibility.UNLISTED };
    expect(await canViewUser(user, ANON)).toBe(true);
  });

  test("PRIVATE user → not visible to anonymous", async () => {
    const user = { id: "owner-1", visibility: Visibility.PRIVATE };
    expect(await canViewUser(user, ANON)).toBe(false);
  });

  test("PRIVATE user → not visible to logged-in non-follower", async () => {
    const user = { id: "owner-1", visibility: Visibility.PRIVATE };
    vi.mocked(prisma.follow.findFirst).mockResolvedValue(null);
    expect(await canViewUser(user, VIEWER)).toBe(false);
  });

  test("PRIVATE user → visible to a follower", async () => {
    const user = { id: "owner-1", visibility: Visibility.PRIVATE };
    vi.mocked(prisma.follow.findFirst).mockResolvedValue({ id: "follow-1" } as never);
    expect(await canViewUser(user, VIEWER)).toBe(true);
  });

  test("PRIVATE user → visible to the user themselves", async () => {
    const user = { id: "owner-1", visibility: Visibility.PRIVATE };
    expect(await canViewUser(user, OWNER)).toBe(true);
  });
});

// ── canViewPage ───────────────────────────────────────────────────────────────

describe("canViewPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("PUBLIC page → visible to anyone", async () => {
    const page = { id: "page-1", visibility: Visibility.PUBLIC };
    expect(await canViewPage(page, ANON)).toBe(true);
  });

  test("UNLISTED page → visible to anyone", async () => {
    const page = { id: "page-1", visibility: Visibility.UNLISTED };
    expect(await canViewPage(page, ANON)).toBe(true);
  });

  test("PRIVATE page → not visible to anonymous", async () => {
    const page = { id: "page-1", visibility: Visibility.PRIVATE };
    expect(await canViewPage(page, ANON)).toBe(false);
  });

  test("PRIVATE page → not visible to logged-in non-member", async () => {
    const page = { id: "page-1", visibility: Visibility.PRIVATE };
    expect(await canViewPage(page, VIEWER)).toBe(false);
  });

  test("PRIVATE page → visible to a member", async () => {
    const page = { id: "page-1", visibility: Visibility.PRIVATE };
    expect(await canViewPage(page, MEMBER)).toBe(true);
  });
});

// ── canViewEvent ──────────────────────────────────────────────────────────────

describe("canViewEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  const makeEvent = (visibility: Visibility, pageId: string | null = null) => ({
    id: "event-1",
    userId: "owner-1",
    pageId,
    visibility,
  });

  test("PUBLIC event → visible to anonymous", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PUBLIC), ANON)).toBe(true);
  });

  test("UNLISTED event → visible to anonymous", async () => {
    expect(await canViewEvent(makeEvent(Visibility.UNLISTED), ANON)).toBe(true);
  });

  test("PRIVATE standalone event → not visible to anonymous", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE), ANON)).toBe(false);
  });

  test("PRIVATE standalone event → not visible to non-owner", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE), VIEWER)).toBe(false);
  });

  test("PRIVATE standalone event → visible to creator", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE), OWNER)).toBe(true);
  });

  test("PRIVATE page event → visible to page member", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE, "page-1"), MEMBER)).toBe(true);
  });

  test("PRIVATE page event → not visible to non-member", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE, "page-1"), VIEWER)).toBe(false);
  });
});

// ── canViewPost ───────────────────────────────────────────────────────────────

describe("canViewPost", () => {
  beforeEach(() => vi.clearAllMocks());

  const makePost = (visibility: Visibility, pageId: string | null = null, eventId: string | null = null) => ({
    id: "post-1",
    userId: "owner-1",
    pageId,
    eventId,
    visibility,
  });

  test("PUBLIC post → visible to anonymous", async () => {
    expect(await canViewPost(makePost(Visibility.PUBLIC), ANON)).toBe(true);
  });

  test("UNLISTED post → visible to anonymous", async () => {
    expect(await canViewPost(makePost(Visibility.UNLISTED), ANON)).toBe(true);
  });

  test("PRIVATE post → not visible to anonymous", async () => {
    expect(await canViewPost(makePost(Visibility.PRIVATE), ANON)).toBe(false);
  });

  test("PRIVATE post → visible to author", async () => {
    expect(await canViewPost(makePost(Visibility.PRIVATE), OWNER)).toBe(true);
  });

  test("PRIVATE page post → visible to page member", async () => {
    expect(await canViewPost(makePost(Visibility.PRIVATE, "page-1"), MEMBER)).toBe(true);
  });

  test("PRIVATE page post → not visible to non-member", async () => {
    expect(await canViewPost(makePost(Visibility.PRIVATE, "page-1"), VIEWER)).toBe(false);
  });
});

// ── listVisibilityWhere ───────────────────────────────────────────────────────

describe("listVisibilityWhere helpers", () => {
  test("userListWhere — anonymous returns PUBLIC-only filter", () => {
    const where = userListWhere(ANON);
    expect(where).toEqual({ visibility: Visibility.PUBLIC });
  });

  test("userListWhere — viewer returns PUBLIC + own", () => {
    const where = userListWhere(VIEWER) as { OR: unknown[] };
    expect(where.OR).toHaveLength(2);
  });

  test("pageListWhere — anonymous returns PUBLIC-only filter", () => {
    const where = pageListWhere(ANON);
    expect(where).toEqual({ visibility: Visibility.PUBLIC });
  });

  test("pageListWhere — member includes member pages in OR", () => {
    const where = pageListWhere(MEMBER) as { OR: unknown[] };
    expect(where.OR).toHaveLength(2);
  });

  test("eventListWhere — anonymous returns PUBLIC-only filter", () => {
    const where = eventListWhere(ANON);
    expect(where).toEqual({ visibility: Visibility.PUBLIC });
  });

  test("postListWhere — anonymous returns PUBLIC-only filter", () => {
    const where = postListWhere(ANON);
    expect(where).toEqual({ visibility: Visibility.PUBLIC });
  });
});
