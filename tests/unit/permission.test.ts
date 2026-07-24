/**
 * Permission utility tests — canPostAsPage, canManagePage
 *
 * These are the gatekeepers for all "act as a Page" operations.
 * Prisma is mocked so no DB connection is required.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { PermissionRole, ResourceType } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    permission: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import {
  canPostAsPage,
  canManagePage,
  canActAsEntity,
  isSelfServiceRole,
  wouldRemoveLastAdmin,
  getMemberPageIds,
  getMemberPageIdsForUsers,
} from "@/lib/utils/server/permission";
import { prisma } from "@/lib/utils/server/prisma";

const makePermission = (role: PermissionRole) => ({
  id: "perm-1",
  userId: "user-1",
  resourceId: "page-1",
  resourceType: ResourceType.PAGE,
  role,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ---------------------------------------------------------------------------
// canPostAsPage — ADMIN or EDITOR may act as a page
// ---------------------------------------------------------------------------
describe("canPostAsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("ADMIN → allowed", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(makePermission(PermissionRole.ADMIN));
    expect(await canPostAsPage("user-1", "page-1")).toBe(true);
  });

  test("EDITOR → allowed", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(makePermission(PermissionRole.EDITOR));
    expect(await canPostAsPage("user-1", "page-1")).toBe(true);
  });

  // Prisma returns null when MEMBER role doesn't match the [ADMIN, EDITOR] filter
  test("MEMBER → denied", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canPostAsPage("user-1", "page-1")).toBe(false);
  });

  test("no permission record → denied", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canPostAsPage("user-1", "page-1")).toBe(false);
  });

  test("non-existent pageId → denied", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canPostAsPage("user-1", "page-nonexistent")).toBe(false);
  });

  test("queries with correct userId, pageId, resourceType, and roles", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    await canPostAsPage("user-1", "page-1");
    expect(vi.mocked(prisma.permission.findFirst)).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        resourceId: "page-1",
        resourceType: ResourceType.PAGE,
        role: { in: [PermissionRole.ADMIN, PermissionRole.EDITOR] },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// canManagePage — ADMIN only (e.g. page settings, member management)
// ---------------------------------------------------------------------------
describe("canManagePage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("ADMIN → allowed", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(makePermission(PermissionRole.ADMIN));
    expect(await canManagePage("user-1", "page-1")).toBe(true);
  });

  test("EDITOR → denied (manage requires ADMIN)", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canManagePage("user-1", "page-1")).toBe(false);
    // Confirm only ADMIN is in the role filter
    expect(vi.mocked(prisma.permission.findFirst)).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        resourceId: "page-1",
        resourceType: ResourceType.PAGE,
        role: { in: [PermissionRole.ADMIN] },
      },
    });
  });

  test("no permission → denied", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canManagePage("user-1", "page-1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canActAsEntity — unified permission gate for manage routes (/profile, /connections, /settings)
// ---------------------------------------------------------------------------
// The shape passed in matches what `findEntityByHandle` returns: exactly one
// of `user` / `page` is populated. We test both branches plus the edge cases
// (entity has neither, entity has both — defensive).
describe("canActAsEntity", () => {
  beforeEach(() => vi.clearAllMocks());

  // Minimal shape — only the fields canActAsEntity actually reads.
  const userEntity = (id: string) => ({ user: { id } as never, page: null });
  const pageEntity = (id: string) => ({ user: null, page: { id } as never });

  // --- User branch: caller must be that user ---
  test("User entity, caller IS that user → allowed", async () => {
    expect(await canActAsEntity("user-1", userEntity("user-1"))).toBe(true);
  });

  test("User entity, caller is a different user → denied", async () => {
    expect(await canActAsEntity("user-2", userEntity("user-1"))).toBe(false);
  });

  // --- Page branch: ADMIN or EDITOR allowed ---
  test("Page entity, caller is ADMIN → allowed", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(makePermission(PermissionRole.ADMIN));
    expect(await canActAsEntity("user-1", pageEntity("page-1"))).toBe(true);
  });

  test("Page entity, caller is EDITOR → allowed", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(makePermission(PermissionRole.EDITOR));
    expect(await canActAsEntity("user-1", pageEntity("page-1"))).toBe(true);
  });

  test("Page entity, caller has no permission → denied", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    expect(await canActAsEntity("user-1", pageEntity("page-1"))).toBe(false);
  });

  test("Page entity, query uses correct PAGE resource type and ADMIN+EDITOR roles", async () => {
    vi.mocked(prisma.permission.findFirst).mockResolvedValue(null);
    await canActAsEntity("user-1", pageEntity("page-1"));
    expect(vi.mocked(prisma.permission.findFirst)).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        resourceId: "page-1",
        resourceType: ResourceType.PAGE,
        role: { in: [PermissionRole.ADMIN, PermissionRole.EDITOR] },
      },
    });
  });

  // --- Edge: entity with neither populated (shouldn't happen with
  // findEntityByHandle, but defend against it anyway) ---
  test("entity with neither user nor page → denied", async () => {
    expect(await canActAsEntity("user-1", { user: null, page: null })).toBe(false);
  });

  // --- Edge: short-circuits to user branch when both are populated ---
  // findEntityByHandle never returns this shape (mutually exclusive @unique
  // FKs), but the function semantics prefer User.
  test("entity with both user and page → checks user branch only (does not hit DB)", async () => {
    const result = await canActAsEntity("user-1", {
      user: { id: "user-1" } as never,
      page: { id: "page-1" } as never,
    });
    expect(result).toBe(true);
    expect(vi.mocked(prisma.permission.findFirst)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// isSelfServiceRole — null or MEMBER may use the self-service join/leave flow
// ---------------------------------------------------------------------------
describe("isSelfServiceRole", () => {
  test("null (no role yet) → true", () => {
    expect(isSelfServiceRole(null)).toBe(true);
  });
  test("MEMBER → true", () => {
    expect(isSelfServiceRole(PermissionRole.MEMBER)).toBe(true);
  });
  test("EDITOR → false", () => {
    expect(isSelfServiceRole(PermissionRole.EDITOR)).toBe(false);
  });
  test("ADMIN → false", () => {
    expect(isSelfServiceRole(PermissionRole.ADMIN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// wouldRemoveLastAdmin — guards remove AND demote of the sole admin
// ---------------------------------------------------------------------------
describe("wouldRemoveLastAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  test("target is the only ADMIN → true (blocks remove/demote)", async () => {
    vi.mocked(prisma.permission.findUnique).mockResolvedValue(makePermission(PermissionRole.ADMIN));
    vi.mocked(prisma.permission.count).mockResolvedValue(1);
    expect(await wouldRemoveLastAdmin("page-1", "user-1")).toBe(true);
  });

  test("target is an ADMIN but others remain → false", async () => {
    vi.mocked(prisma.permission.findUnique).mockResolvedValue(makePermission(PermissionRole.ADMIN));
    vi.mocked(prisma.permission.count).mockResolvedValue(2);
    expect(await wouldRemoveLastAdmin("page-1", "user-1")).toBe(false);
  });

  test("target is not an ADMIN → false without counting (can't orphan)", async () => {
    vi.mocked(prisma.permission.findUnique).mockResolvedValue(makePermission(PermissionRole.MEMBER));
    expect(await wouldRemoveLastAdmin("page-1", "user-1")).toBe(false);
    expect(vi.mocked(prisma.permission.count)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getMemberPageIds — the "membership edge" set: ANY role, no filter (must keep MEMBER)
// ---------------------------------------------------------------------------
describe("getMemberPageIds", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns every page the user holds any role on, with NO role filter", async () => {
    vi.mocked(prisma.permission.findMany).mockResolvedValue([
      { resourceId: "p-admin" }, { resourceId: "p-editor" }, { resourceId: "p-member" },
    ] as never);
    expect(await getMemberPageIds("user-1")).toEqual(["p-admin", "p-editor", "p-member"]);
    // The query must NOT constrain `role` — a MEMBER edge still grants private access.
    const where = vi.mocked(prisma.permission.findMany).mock.calls[0][0]?.where as Record<string, unknown>;
    expect(where).toEqual({ userId: "user-1", resourceType: ResourceType.PAGE });
    expect(where).not.toHaveProperty("role");
  });

  test("no rows → empty array", async () => {
    vi.mocked(prisma.permission.findMany).mockResolvedValue([] as never);
    expect(await getMemberPageIds("user-1")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getMemberPageIdsForUsers — batched variant → userId → pageIds[] map
// ---------------------------------------------------------------------------
describe("getMemberPageIdsForUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  test("groups rows into a per-user map (any role)", async () => {
    vi.mocked(prisma.permission.findMany).mockResolvedValue([
      { userId: "u1", resourceId: "pA" },
      { userId: "u1", resourceId: "pB" },
      { userId: "u2", resourceId: "pA" },
    ] as never);
    const map = await getMemberPageIdsForUsers(["u1", "u2", "u3"]);
    expect(map.get("u1")).toEqual(["pA", "pB"]);
    expect(map.get("u2")).toEqual(["pA"]);
    expect(map.has("u3")).toBe(false); // no rows → absent from map
  });

  test("empty input → empty map, no query issued", async () => {
    const map = await getMemberPageIdsForUsers([]);
    expect(map.size).toBe(0);
    expect(vi.mocked(prisma.permission.findMany)).not.toHaveBeenCalled();
  });
});
