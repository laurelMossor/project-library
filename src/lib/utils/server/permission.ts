// ⚠️ SERVER-ONLY: Permission utility functions
//
// The single owner of permission semantics. No route or component should query
// `prisma.permission` directly or compare `PermissionRole` inline — route every
// authorization decision through a helper here. The role *vocabulary* (value sets,
// predicates) lives in `@/lib/const/roles`; the *decisions* live in this file.
//
// Two capability tiers on a Page — NOT interchangeable:
//   ADMIN         → management: members, roles, privacy, destructive/config  → canManagePage
//   ADMIN/EDITOR  → act as the page: author content, message, comment         → canPostAsPage
//                   (canActAsEntity = that same tier, plus "be the user" for a User entity)
import { prisma } from "./prisma";
import { PermissionRole, ResourceType, type Page, type User } from "@prisma/client";
import { ACTING_ROLES } from "@/lib/const/roles";

/** Check if a user has a specific permission on a resource */
export async function hasPermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType,
  roles: PermissionRole[]
): Promise<boolean> {
  const permission = await prisma.permission.findFirst({
    where: { userId, resourceId, resourceType, role: { in: roles } },
  });
  return permission !== null;
}

/** Check if user can post as a page (ADMIN or EDITOR) */
export async function canPostAsPage(userId: string, pageId: string): Promise<boolean> {
  return hasPermission(userId, pageId, ResourceType.PAGE, [...ACTING_ROLES]);
}

/** Check if user can manage a page (ADMIN only — page config / destructive actions). */
export async function canManagePage(userId: string, pageId: string): Promise<boolean> {
  return hasPermission(userId, pageId, ResourceType.PAGE, [PermissionRole.ADMIN]);
}

/** True for a role that the self-service join/leave flow may set or clear (no role yet, or plain MEMBER). */
export function isSelfServiceRole(role: PermissionRole | null): boolean {
  return role === null || role === PermissionRole.MEMBER;
}

/** Count ADMIN permissions on a page. */
export async function getAdminCount(pageId: string): Promise<number> {
  return prisma.permission.count({
    where: { resourceId: pageId, resourceType: ResourceType.PAGE, role: PermissionRole.ADMIN },
  });
}

/**
 * Would removing OR demoting `targetUserId` leave the page with zero admins?
 * Single source of truth for the last-admin guard — used by member remove,
 * admin remove, role-change (demote), and self-leave. Returns false when the
 * target isn't currently an ADMIN (removing/demoting a MEMBER/EDITOR can't orphan).
 */
export async function wouldRemoveLastAdmin(pageId: string, targetUserId: string): Promise<boolean> {
  const targetRole = await getUserPermission(targetUserId, pageId, ResourceType.PAGE);
  if (targetRole !== PermissionRole.ADMIN) return false;
  return (await getAdminCount(pageId)) <= 1;
}

/** Page IDs the user can manage (ADMIN or EDITOR). */
export async function getManagedPageIds(userId: string): Promise<string[]> {
  const perms = await prisma.permission.findMany({
    where: { userId, resourceType: ResourceType.PAGE, role: { in: [...ACTING_ROLES] } },
    select: { resourceId: true },
  });
  return perms.map((p) => p.resourceId);
}

/**
 * Page IDs a user holds ANY role on (ADMIN/EDITOR/MEMBER — no role filter). This is
 * the "membership edge" set used by the visibility layer (`isMember`), distinct from
 * `getManagedPageIds` (ADMIN/EDITOR only). MEMBER must be included here.
 */
export async function getMemberPageIds(userId: string): Promise<string[]> {
  const perms = await prisma.permission.findMany({
    where: { userId, resourceType: ResourceType.PAGE },
    select: { resourceId: true },
  });
  return perms.map((p) => p.resourceId);
}

/**
 * Batched `getMemberPageIds`: for many users at once, a `userId → pageIds[]` map (any
 * role, no filter). Users with no page roles are absent from the map. Used by the email
 * flush, which resolves membership for a whole batch of recipients in one query.
 */
export async function getMemberPageIdsForUsers(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  const perms = await prisma.permission.findMany({
    where: { userId: { in: userIds }, resourceType: ResourceType.PAGE },
    select: { userId: true, resourceId: true },
  });
  for (const p of perms) {
    const list = map.get(p.userId) ?? [];
    list.push(p.resourceId);
    map.set(p.userId, list);
  }
  return map;
}

/** Get user's role on a resource */
export async function getUserPermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType
): Promise<PermissionRole | null> {
  const permission = await prisma.permission.findUnique({
    where: { userId_resourceId_resourceType: { userId, resourceId, resourceType } },
  });
  return permission?.role ?? null;
}

/** A user's page permission rows (PAGE resources only), oldest first. Shared base for the page fetchers. */
async function getUserPagePermissions(userId: string) {
  return prisma.permission.findMany({
    where: { userId, resourceType: ResourceType.PAGE },
    orderBy: { createdAt: "asc" },
  });
}

/** Get all pages a user has permissions on, with the user's role attached to each. */
export async function getPagesForUser(userId: string) {
  const permissions = await getUserPagePermissions(userId);
  if (permissions.length === 0) return [];

  const pageIds = permissions.map((p) => p.resourceId);
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      name: true,
      handle: true,
      headline: true,
      bio: true,
      interests: true,
      location: true,
      avatarImageId: true,
      avatarImage: { select: { url: true } },
      createdAt: true,
      updatedAt: true,
      createdByUserId: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
      category: true,
      tags: true,
    },
  });

  return pages.map((page) => ({
    ...page,
    role: permissions.find((p) => p.resourceId === page.id)!.role,
  }));
}

/** Get all pages a user has any role on, as { id: permissionId, role, page } membership rows. */
export async function getUserMemberships(userId: string) {
  const permissions = await getUserPagePermissions(userId);
  if (permissions.length === 0) return [];

  const pageIds = permissions.map((p) => p.resourceId);
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, name: true, handle: true, avatarImageId: true, avatarImage: { select: { url: true } } },
  });

  return pages.map((page) => {
    const perm = permissions.find((p) => p.resourceId === page.id)!;
    return { id: perm.id, role: perm.role, page };
  });
}

/** Minimal Prisma client surface needed by the write helpers — the global client or a $transaction tx. */
type PermissionWriteClient = Pick<typeof prisma, "permission">;

/** Grant a permission. Pass `tx` to run inside an existing transaction. */
export async function grantPermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType,
  role: PermissionRole,
  tx: PermissionWriteClient = prisma,
) {
  return tx.permission.upsert({
    where: { userId_resourceId_resourceType: { userId, resourceId, resourceType } },
    update: { role },
    create: { userId, resourceId, resourceType, role },
  });
}

/** Revoke a permission */
export async function revokePermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType
) {
  return prisma.permission.deleteMany({
    where: { userId, resourceId, resourceType },
  });
}

/** Get all users with permissions on a resource */
export async function getResourcePermissions(
  resourceId: string,
  resourceType: ResourceType
) {
  return prisma.permission.findMany({
    where: { resourceId, resourceType },
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarImageId: true,
          avatarImage: { select: { url: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Unified manage-permission gate.
 *
 * Used by session-scoped manage routes (`/profile`, `/connections`, `/settings`)
 * and any server-side code that needs to verify a user can act on an entity.
 *
 * Rules:
 *   - User entity: caller must BE that user.
 *   - Page entity: caller must have ADMIN or EDITOR on the page.
 *   - Anything else (entity has neither, or both null): refuse.
 *
 * Accepts the partial-include shape from `findEntityByHandle`, which
 * populates exactly one of `user` / `page`.
 */
export async function canActAsEntity(
  userId: string,
  entity: { user?: Pick<User, "id"> | null; page?: Pick<Page, "id"> | null },
): Promise<boolean> {
  if (entity.user) return entity.user.id === userId;
  if (entity.page) {
    return hasPermission(userId, entity.page.id, ResourceType.PAGE, [...ACTING_ROLES]);
  }
  return false;
}
