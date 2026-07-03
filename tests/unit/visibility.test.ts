/**
 * Visibility helper unit tests — shared primitives (isFollower/isMember),
 * unified gates (canViewProfile/canViewUser/canViewPage/canViewEvent/canViewPost),
 * requireViewableProfile, list filters, collectionVisibilityWhere, inheritance,
 * cascade, and the embed-selector privacy guard.
 *
 * Two-field model: profiles carry profileVisibility {PUBLIC,PRIVATE}; content carries a
 * derived visibility {LISTED,UNLISTED,PRIVATE}. Prisma is mocked so no DB is required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ContentVisibility, ProfileVisibility } from "@prisma/client";
import type { ViewerContext } from "@/lib/utils/server/visibility";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    follow: { findFirst: vi.fn() },
    permission: { findMany: vi.fn() },
    post: { updateMany: vi.fn() },
    event: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
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
  resolveProfileAccess,
  profileListWhere,
  collectionVisibilityWhere,
  eventListWhere,
  postListWhere,
  resolveParentVisibility,
  syncDescendantVisibility,
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
  vi.mocked(prisma.follow.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.event.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.post.updateMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.event.updateMany).mockResolvedValue({ count: 0 } as never);
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

// ── canViewUser (profileVisibility) ───────────────────────────────────────────

describe("canViewUser", () => {
  test("PUBLIC → visible to anyone (anon)", async () => {
    expect(await canViewUser({ id: "owner-1", profileVisibility: ProfileVisibility.PUBLIC }, ANON)).toBe(true);
  });

  test("PRIVATE → not visible to anonymous or a logged-in non-follower", async () => {
    expect(await canViewUser({ id: "owner-1", profileVisibility: ProfileVisibility.PRIVATE }, ANON)).toBe(false);
    expect(await canViewUser({ id: "owner-1", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe(false);
  });

  test("PRIVATE → visible to a follower and to the user themselves", async () => {
    expect(await canViewUser({ id: "owner-1", profileVisibility: ProfileVisibility.PRIVATE }, OWNER)).toBe(true);
    followYes();
    expect(await canViewUser({ id: "owner-1", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe(true);
  });
});

// ── canViewPage (profileVisibility) ───────────────────────────────────────────

describe("canViewPage", () => {
  test("PUBLIC → visible to anyone", async () => {
    expect(await canViewPage({ id: "page-1", profileVisibility: ProfileVisibility.PUBLIC }, ANON)).toBe(true);
  });

  test("PRIVATE → not visible to anon / non-member non-follower", async () => {
    expect(await canViewPage({ id: "page-1", profileVisibility: ProfileVisibility.PRIVATE }, ANON)).toBe(false);
    expect(await canViewPage({ id: "page-1", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe(false);
  });

  test("PRIVATE → visible to a member, and to a follower (no membership)", async () => {
    expect(await canViewPage({ id: "page-1", profileVisibility: ProfileVisibility.PRIVATE }, MEMBER)).toBe(true);
    followYes();
    expect(await canViewPage({ id: "page-1", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe(true);
  });
});

// ── canViewEvent (content visibility) ─────────────────────────────────────────

describe("canViewEvent", () => {
  const makeEvent = (visibility: ContentVisibility, pageId: string | null = null) => ({
    id: "event-1",
    userId: "owner-1",
    pageId,
    visibility,
  });

  test("LISTED / UNLISTED → visible to anonymous", async () => {
    expect(await canViewEvent(makeEvent(ContentVisibility.LISTED), ANON)).toBe(true);
    expect(await canViewEvent(makeEvent(ContentVisibility.UNLISTED), ANON)).toBe(true);
  });

  test("PRIVATE standalone → anon/non-owner denied, owner allowed", async () => {
    expect(await canViewEvent(makeEvent(ContentVisibility.PRIVATE), ANON)).toBe(false);
    expect(await canViewEvent(makeEvent(ContentVisibility.PRIVATE), VIEWER)).toBe(false);
    expect(await canViewEvent(makeEvent(ContentVisibility.PRIVATE), OWNER)).toBe(true);
  });

  test("PRIVATE standalone → visible to the owner's follower", async () => {
    followYes();
    expect(await canViewEvent(makeEvent(ContentVisibility.PRIVATE), VIEWER)).toBe(true);
  });

  test("PRIVATE page event → member yes, non-member non-follower no, follower yes", async () => {
    expect(await canViewEvent(makeEvent(ContentVisibility.PRIVATE, "page-1"), MEMBER)).toBe(true);
    expect(await canViewEvent(makeEvent(ContentVisibility.PRIVATE, "page-1"), VIEWER)).toBe(false);
    followYes();
    expect(await canViewEvent(makeEvent(ContentVisibility.PRIVATE, "page-1"), VIEWER)).toBe(true);
  });
});

// ── canViewPost (content visibility) ──────────────────────────────────────────

describe("canViewPost", () => {
  const makePost = (visibility: ContentVisibility, pageId: string | null = null, eventId: string | null = null) => ({
    id: "post-1",
    userId: "owner-1",
    pageId,
    eventId,
    visibility,
  });

  test("LISTED / UNLISTED → visible to anonymous", async () => {
    expect(await canViewPost(makePost(ContentVisibility.LISTED), ANON)).toBe(true);
    expect(await canViewPost(makePost(ContentVisibility.UNLISTED), ANON)).toBe(true);
  });

  test("PRIVATE standalone → author yes, anon no, follower yes", async () => {
    expect(await canViewPost(makePost(ContentVisibility.PRIVATE), ANON)).toBe(false);
    expect(await canViewPost(makePost(ContentVisibility.PRIVATE), OWNER)).toBe(true);
    followYes();
    expect(await canViewPost(makePost(ContentVisibility.PRIVATE), VIEWER)).toBe(true);
  });

  test("PRIVATE page post → member yes, non-member non-follower no, follower yes", async () => {
    expect(await canViewPost(makePost(ContentVisibility.PRIVATE, "page-1"), MEMBER)).toBe(true);
    expect(await canViewPost(makePost(ContentVisibility.PRIVATE, "page-1"), VIEWER)).toBe(false);
    followYes();
    expect(await canViewPost(makePost(ContentVisibility.PRIVATE, "page-1"), VIEWER)).toBe(true);
  });
});

// ── requireViewableProfile ──────────────────────────────────────────────────

describe("requireViewableProfile", () => {
  test("missing entity → null", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    expect(await requireViewableProfile("USER", "nope", ANON)).toBeNull();
  });

  test("public entity → returns it", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", profileVisibility: ProfileVisibility.PUBLIC } as never);
    expect(await requireViewableProfile("USER", "u1", ANON)).toEqual({ id: "u1", profileVisibility: ProfileVisibility.PUBLIC });
  });

  test("private entity, non-follower → null", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1", profileVisibility: ProfileVisibility.PRIVATE } as never);
    expect(await requireViewableProfile("USER", "u1", VIEWER)).toBeNull();
  });
});

// ── list filters (global feeds/search) ────────────────────────────────────────

describe("profileListWhere — all profiles discoverable", () => {
  test("returns {} regardless of viewer (PRIVATE profiles show as search stubs)", () => {
    expect(profileListWhere("USER", ANON)).toEqual({});
    expect(profileListWhere("USER", VIEWER)).toEqual({});
    expect(profileListWhere("PAGE", ANON)).toEqual({});
    expect(profileListWhere("PAGE", MEMBER)).toEqual({});
  });
});

describe("eventListWhere / postListWhere — only LISTED content, plus own", () => {
  test("anon → LISTED-only", () => {
    expect(eventListWhere(ANON)).toEqual({ visibility: { in: [ContentVisibility.LISTED] } });
    expect(postListWhere(ANON)).toEqual({ visibility: { in: [ContentVisibility.LISTED] } });
  });
  test("member → LISTED plus own user + member pages", () => {
    expect((eventListWhere(MEMBER) as { OR: unknown[] }).OR).toHaveLength(3);
    expect((postListWhere(MEMBER) as { OR: unknown[] }).OR).toHaveLength(3);
  });
});

// ── collectionVisibilityWhere (an entity's own collection) ────────────────────

describe("collectionVisibilityWhere", () => {
  const restricted = { visibility: { in: [ContentVisibility.LISTED, ContentVisibility.UNLISTED] } };

  test("USER — owner sees all", async () => {
    expect(await collectionVisibilityWhere("USER", "owner-1", OWNER)).toEqual({});
  });
  test("USER — anon/non-follower restricted to LISTED+UNLISTED", async () => {
    expect(await collectionVisibilityWhere("USER", "owner-1", ANON)).toEqual(restricted);
    expect(await collectionVisibilityWhere("USER", "owner-1", VIEWER)).toEqual(restricted);
  });
  test("USER — follower sees all", async () => {
    followYes();
    expect(await collectionVisibilityWhere("USER", "owner-1", VIEWER)).toEqual({});
  });
  test("PAGE — member sees all; non-member restricted; follower sees all", async () => {
    expect(await collectionVisibilityWhere("PAGE", "page-1", MEMBER)).toEqual({});
    expect(await collectionVisibilityWhere("PAGE", "page-1", VIEWER)).toEqual(restricted);
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
    for (const key of [...SENSITIVE, "headline", "profileVisibility", "contentVisibility"]) {
      expect(Object.prototype.hasOwnProperty.call(publicPageEmbedFields, key)).toBe(false);
    }
  });
});

// ── resolveParentVisibility (inheritance for newly-created content) ───────────

describe("resolveParentVisibility", () => {
  test("page context wins and short-circuits — returns the page's contentVisibility", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue({ contentVisibility: ContentVisibility.PRIVATE } as never);
    expect(await resolveParentVisibility("owner-1", "page-1", "event-1")).toBe(ContentVisibility.PRIVATE);
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("event context (no page) — returns the event's stored visibility", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ visibility: ContentVisibility.UNLISTED } as never);
    expect(await resolveParentVisibility("owner-1", null, "event-1")).toBe(ContentVisibility.UNLISTED);
  });

  test("standalone (no page/event) — returns the author's contentVisibility", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ contentVisibility: ContentVisibility.PRIVATE } as never);
    expect(await resolveParentVisibility("owner-1")).toBe(ContentVisibility.PRIVATE);
  });

  test("missing parent row → defaults to LISTED (doesn't crash)", async () => {
    vi.mocked(prisma.page.findUnique).mockResolvedValue(null as never);
    expect(await resolveParentVisibility("owner-1", "missing-page")).toBe(ContentVisibility.LISTED);
  });
});

// ── syncDescendantVisibility (cascade when a parent's contentVisibility changes) ─

describe("syncDescendantVisibility", () => {
  test("PAGE → cascades to the page's posts, its events, and those events' posts", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([{ id: "e1" }, { id: "e2" }] as never);

    await syncDescendantVisibility("PAGE", "page-1", ContentVisibility.PRIVATE);

    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { pageId: "page-1" },
      data: { visibility: ContentVisibility.PRIVATE },
    });
    expect(prisma.event.updateMany).toHaveBeenCalledWith({
      where: { pageId: "page-1" },
      data: { visibility: ContentVisibility.PRIVATE },
    });
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { eventId: { in: ["e1", "e2"] } },
      data: { visibility: ContentVisibility.PRIVATE },
    });
  });

  test("USER → only standalone content cascades (page-authored content is excluded)", async () => {
    await syncDescendantVisibility("USER", "owner-1", ContentVisibility.PRIVATE);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { userId: "owner-1", pageId: null, eventId: null },
      data: { visibility: ContentVisibility.PRIVATE },
    });
    expect(prisma.event.updateMany).toHaveBeenCalledWith({
      where: { userId: "owner-1", pageId: null },
      data: { visibility: ContentVisibility.PRIVATE },
    });
  });

  test("a LISTED→UNLISTED flip writes UNLISTED to descendants", async () => {
    await syncDescendantVisibility("EVENT", "event-1", ContentVisibility.UNLISTED);
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { eventId: "event-1" },
      data: { visibility: ContentVisibility.UNLISTED },
    });
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
  });

  test("uses the provided transaction client, not the global prisma", async () => {
    const tx = {
      post: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      event: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    await syncDescendantVisibility("EVENT", "event-1", ContentVisibility.PRIVATE, tx as never);
    expect(tx.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });
});

// ── resolveProfileAccess — tri-state gate for the SSR dispatcher ──────────────

describe("resolveProfileAccess", () => {
  test("PUBLIC → FULL for anyone", async () => {
    expect(await resolveProfileAccess("USER", { id: "owner-1", profileVisibility: ProfileVisibility.PUBLIC }, ANON)).toBe("FULL");
    expect(await resolveProfileAccess("PAGE", { id: "page-9", profileVisibility: ProfileVisibility.PUBLIC }, ANON)).toBe("FULL");
  });

  test("PRIVATE, logged-in non-member → LOCKED (stub)", async () => {
    expect(await resolveProfileAccess("USER", { id: "owner-1", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe("LOCKED");
    expect(await resolveProfileAccess("PAGE", { id: "page-9", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe("LOCKED");
  });

  test("PRIVATE, anonymous viewer → LOCKED (discoverable stub, no longer existence-denied)", async () => {
    expect(await resolveProfileAccess("USER", { id: "owner-1", profileVisibility: ProfileVisibility.PRIVATE }, ANON)).toBe("LOCKED");
    expect(await resolveProfileAccess("PAGE", { id: "page-9", profileVisibility: ProfileVisibility.PRIVATE }, ANON)).toBe("LOCKED");
  });

  test("PRIVATE with an edge (follower / member / owner) → FULL", async () => {
    expect(await resolveProfileAccess("PAGE", { id: "page-1", profileVisibility: ProfileVisibility.PRIVATE }, MEMBER)).toBe("FULL");
    expect(await resolveProfileAccess("USER", { id: "viewer-1", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe("FULL");
    followYes();
    expect(await resolveProfileAccess("USER", { id: "owner-1", profileVisibility: ProfileVisibility.PRIVATE }, VIEWER)).toBe("FULL");
  });
});
