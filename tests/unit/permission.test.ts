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
    },
  },
}));

import { canPostAsPage, canManagePage } from "@/lib/utils/server/permission";
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
