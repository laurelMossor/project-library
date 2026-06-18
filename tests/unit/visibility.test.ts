/**
 * Visibility helper unit tests — shared primitives (isFollower/isMember),
 * unified gates (canViewProfile/canViewUser/canViewPage/canViewEvent/canViewPost),
 * requireViewableProfile, profileListWhere, collectionVisibilityWhere, and the
 * embed-selector privacy guard.
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
    user: { findUnique: vi.fn() },
    page: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/utils/server/session", () => ({
  getSessionContext: vi.fn(),
}));

import {
  isFollower,
  isMember,
  canViewUser,
  canViewPage,
  canViewEvent,
  canViewPost,
  requireViewableProfile,
  profileListWhere,
  collectionVisibilityWhere,
  eventListWhere,
  postListWhere,
} from "@/lib/utils/server/visibility";
import { publicUserEmbedFields } from "@/lib/utils/server/user";
import { publicPageEmbedFields } from "@/lib/utils/server/fields";
import { prisma } from "@/lib/utils/server/prisma";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ANON: ViewerContext = { userId: null, memberPageIds: [] };
const VIEWER: ViewerContext = { userId: "viewer-1", memberPageIds: [] };
const MEMBER: ViewerContext = { userId: "viewer-1", memberPageIds: ["page-1"] };
const OWNER: ViewerContext = { userId: "owner-1", memberPageIds: [] };

const followYes = () => vi.mocked(prisma.follow.findFirst).mockResolvedValue({ id: "f1" } as never);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no follow edge exists.
  vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
});

// ── primitives ──────────────────────────────────────────────────────────────

describe("relationship primitives", () => {
  test("isMember reflects memberPageIds", () => {
    expect(isMember(MEMBER, "page-1")).toBe(true);
    expect(isMember(VIEWER, "page-1")).toBe(false);
  });

  test("isFollower follows the follow edge", async () => {
    expect(await isFollower("viewer-1", "owner-1")).toBe(false);
    followYes();
    expect(await isFollower("viewer-1", "owner-1")).toBe(true);
  });
});

// ── canViewUser ───────────────────────────────────────────────────────────────

describe("canViewUser", () => {
  test("PUBLIC / UNLISTED → visible to anyone (anon)", async () => {
    expect(await canViewUser({ id: "owner-1", visibility: Visibility.PUBLIC }, ANON)).toBe(true);
    expect(await canViewUser({ id: "owner-1", visibility: Visibility.UNLISTED }, ANON)).toBe(true);
  });

  test("PRIVATE → not visible to anonymous", async () => {
    expect(await canViewUser({ id: "owner-1", visibility: Visibility.PRIVATE }, ANON)).toBe(false);
  });

  test("PRIVATE → not visible to logged-in non-follower", async () => {
    expect(await canViewUser({ id: "owner-1", visibility: Visibility.PRIVATE }, VIEWER)).toBe(false);
  });

  test("PRIVATE → visible to a follower", async () => {
    followYes();
    expect(await canViewUser({ id: "owner-1", visibility: Visibility.PRIVATE }, VIEWER)).toBe(true);
  });

  test("PRIVATE → visible to the user themselves", async () => {
    expect(await canViewUser({ id: "owner-1", visibility: Visibility.PRIVATE }, OWNER)).toBe(true);
  });
});

// ── canViewPage ───────────────────────────────────────────────────────────────

describe("canViewPage", () => {
  test("PUBLIC / UNLISTED → visible to anyone", async () => {
    expect(await canViewPage({ id: "page-1", visibility: Visibility.PUBLIC }, ANON)).toBe(true);
    expect(await canViewPage({ id: "page-1", visibility: Visibility.UNLISTED }, ANON)).toBe(true);
  });

  test("PRIVATE → not visible to anonymous", async () => {
    expect(await canViewPage({ id: "page-1", visibility: Visibility.PRIVATE }, ANON)).toBe(false);
  });

  test("PRIVATE → not visible to logged-in non-member, non-follower", async () => {
    expect(await canViewPage({ id: "page-1", visibility: Visibility.PRIVATE }, VIEWER)).toBe(false);
  });

  test("PRIVATE → visible to a member", async () => {
    expect(await canViewPage({ id: "page-1", visibility: Visibility.PRIVATE }, MEMBER)).toBe(true);
  });

  test("PRIVATE → visible to a follower (no membership)", async () => {
    followYes();
    expect(await canViewPage({ id: "page-1", visibility: Visibility.PRIVATE }, VIEWER)).toBe(true);
  });
});

// ── canViewEvent ──────────────────────────────────────────────────────────────

describe("canViewEvent", () => {
  const makeEvent = (visibility: Visibility, pageId: string | null = null) => ({
    id: "event-1",
    userId: "owner-1",
    pageId,
    visibility,
  });

  test("PUBLIC / UNLISTED → visible to anonymous", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PUBLIC), ANON)).toBe(true);
    expect(await canViewEvent(makeEvent(Visibility.UNLISTED), ANON)).toBe(true);
  });

  test("PRIVATE standalone → anon/non-owner denied, owner allowed", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE), ANON)).toBe(false);
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE), VIEWER)).toBe(false);
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE), OWNER)).toBe(true);
  });

  test("PRIVATE standalone → visible to the owner's follower", async () => {
    followYes();
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE), VIEWER)).toBe(true);
  });

  test("PRIVATE page event → member yes, non-member non-follower no", async () => {
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE, "page-1"), MEMBER)).toBe(true);
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE, "page-1"), VIEWER)).toBe(false);
  });

  test("PRIVATE page event → visible to a page follower", async () => {
    followYes();
    expect(await canViewEvent(makeEvent(Visibility.PRIVATE, "page-1"), VIEWER)).toBe(true);
  });
});

// ── canViewPost ───────────────────────────────────────────────────────────────

describe("canViewPost", () => {
  const makePost = (visibility: Visibility, pageId: string | null = null, eventId: string | null = null) => ({
    id: "post-1",
    userId: "owner-1",
    pageId,
    eventId,
    visibility,
  });

  test("PUBLIC / UNLISTED → visible to anonymous", async () => {
    expect(await canViewPost(makePost(Visibility.PUBLIC), ANON)).toBe(true);
    expect(await canViewPost(makePost(Visibility.UNLISTED), ANON)).toBe(true);
  });

  test("PRIVATE standalone → author yes, anon no, follower yes", async () => {
    expect(await canViewPost(makePost(Visibility.PRIVATE), ANON)).toBe(false);
    expect(await canViewPost(makePost(Visibility.PRIVATE), OWNER)).toBe(true);
    followYes();
    expect(await canViewPost(makePost(Visibility.PRIVATE), VIEWER)).toBe(true);
  });

  test("PRIVATE page post → member yes, non-member non-follower no", async () => {
    expect(await canViewPost(makePost(Visibility.PRIVATE, "page-1"), MEMBER)).toBe(true);
    expect(await canViewPost(makePost(Visibility.PRIVATE, "page-1"), VIEWER)).toBe(false);
  });

  test("PRIVATE page post → visible to a page follower", async () => {
    followYes();
    expect(await canViewPost(makePost(Visibility.PRIVATE, "page-1"), VIEWER)).toBe(true);
  });
});

// ── requireViewableProfile ──────────────────────────────────────────────────

describe("requireViewableProfile", () => {
  test("missing entity → null", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    expect(await requireViewableProfile("USER", "nope", ANON)).toBeNull();
  });

  test("public entity → returns it", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", visibility: Visibility.PUBLIC } as never);
    expect(await requireViewableProfile("USER", "u1", ANON)).toEqual({ id: "u1", visibility: Visibility.PUBLIC });
  });

  test("private entity, non-follower → null", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", visibility: Visibility.PRIVATE } as never);
    expect(await requireViewableProfile("USER", "u1", VIEWER)).toBeNull();
  });
});

// ── profileListWhere (global feeds/search) ────────────────────────────────────

describe("profileListWhere", () => {
  test("USER — anonymous returns PUBLIC-only", () => {
    expect(profileListWhere("USER", ANON)).toEqual({ visibility: Visibility.PUBLIC });
  });
  test("USER — viewer returns PUBLIC + own", () => {
    expect((profileListWhere("USER", VIEWER) as { OR: unknown[] }).OR).toHaveLength(2);
  });
  test("PAGE — anonymous returns PUBLIC-only", () => {
    expect(profileListWhere("PAGE", ANON)).toEqual({ visibility: Visibility.PUBLIC });
  });
  test("PAGE — member includes member pages in OR", () => {
    expect((profileListWhere("PAGE", MEMBER) as { OR: unknown[] }).OR).toHaveLength(2);
  });
  test("eventListWhere / postListWhere — anon PUBLIC-only", () => {
    expect(eventListWhere(ANON)).toEqual({ visibility: Visibility.PUBLIC });
    expect(postListWhere(ANON)).toEqual({ visibility: Visibility.PUBLIC });
  });
});

// ── collectionVisibilityWhere (an entity's own collection) ────────────────────

describe("collectionVisibilityWhere", () => {
  const restricted = { visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } };

  test("USER — owner sees all", async () => {
    expect(await collectionVisibilityWhere("USER", "owner-1", OWNER)).toEqual({});
  });
  test("USER — anon/non-follower restricted to PUBLIC+UNLISTED", async () => {
    expect(await collectionVisibilityWhere("USER", "owner-1", ANON)).toEqual(restricted);
    expect(await collectionVisibilityWhere("USER", "owner-1", VIEWER)).toEqual(restricted);
  });
  test("USER — follower sees all", async () => {
    followYes();
    expect(await collectionVisibilityWhere("USER", "owner-1", VIEWER)).toEqual({});
  });
  test("PAGE — member sees all; non-member restricted", async () => {
    expect(await collectionVisibilityWhere("PAGE", "page-1", MEMBER)).toEqual({});
    expect(await collectionVisibilityWhere("PAGE", "page-1", VIEWER)).toEqual(restricted);
  });
  test("PAGE — follower sees all", async () => {
    followYes();
    expect(await collectionVisibilityWhere("PAGE", "page-1", VIEWER)).toEqual({});
  });
});

// ── embed-selector privacy guard ──────────────────────────────────────────────

describe("embed selectors exclude sensitive profile fields", () => {
  const SENSITIVE = ["bio", "location", "interests", "aboutContent", "email", "elements"];

  test("publicUserEmbedFields carries no sensitive fields", () => {
    for (const key of SENSITIVE) {
      expect(Object.prototype.hasOwnProperty.call(publicUserEmbedFields, key)).toBe(false);
    }
  });

  test("publicPageEmbedFields carries no sensitive fields", () => {
    for (const key of [...SENSITIVE, "headline", "visibility"]) {
      expect(Object.prototype.hasOwnProperty.call(publicPageEmbedFields, key)).toBe(false);
    }
  });
});
