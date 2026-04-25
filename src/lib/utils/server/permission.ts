// ⚠️ SERVER-ONLY: Permission utility functions
import { prisma } from "./prisma";
import { PermissionRole, ResourceType, type Page, type User } from "@prisma/client";

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
  return hasPermission(userId, pageId, ResourceType.PAGE, [PermissionRole.ADMIN, PermissionRole.EDITOR]);
}

/** Check if user can manage a page (ADMIN only) */
export async function canManagePage(userId: string, pageId: string): Promise<boolean> {
  return hasPermission(userId, pageId, ResourceType.PAGE, [PermissionRole.ADMIN]);
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

/** Get all pages a user has permissions on */
export async function getPagesForUser(userId: string) {
  const permissions = await prisma.permission.findMany({
    where: { userId, resourceType: ResourceType.PAGE },
    orderBy: { createdAt: "asc" },
  });

  if (permissions.length === 0) return [];

  const pageIds = permissions.map(p => p.resourceId);
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      headline: true,
      bio: true,
      interests: true,
      location: true,
      visibility: true,
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
      parentTopic: true,
      tags: true,
      isOpenToCollaborators: true,
    },
  });

  return pages.map(page => ({
    ...page,
    role: permissions.find(p => p.resourceId === page.id)!.role,
  }));
}

/** Get all pages a user has any role on */
export async function getUserMemberships(userId: string) {
  const permissions = await prisma.permission.findMany({
    where: { userId, resourceType: ResourceType.PAGE },
    orderBy: { createdAt: "asc" },
  });

  if (permissions.length === 0) return [];

  const pageIds = permissions.map((p) => p.resourceId);
  const pages = await prisma.page.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, name: true, slug: true, avatarImageId: true, avatarImage: { select: { url: true } } },
  });

  return pages.map((page) => ({
    id: permissions.find((p) => p.resourceId === page.id)!.id,
    role: permissions.find((p) => p.resourceId === page.id)!.role,
    page,
  }));
}

/** Grant a permission */
export async function grantPermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType,
  role: PermissionRole
) {
  return prisma.permission.upsert({
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
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarImageId: true,
          avatarImage: { select: { url: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Unified manage-permission gate for the post-PR2 `/[handle]/...` route tree.
 *
 * Both the User and Page profile trees live under `/[handle]/profile/...` and
 * `/[handle]/connections`. This helper is the single check at the top of
 * every gated server component:
 *
 *   const entity = await findEntityByHandle(params.handle);
 *   if (!entity) return notFound();
 *   const session = await auth();
 *   if (!session?.user?.id || !(await canManageEntity(session.user.id, entity))) {
 *     return notFound(); // privacy-preserving (see Risks in PR 2 plan)
 *   }
 *
 * Rules (mirrors how the old `/u/profile` and `/p/profile` trees gated):
 *   - User entity: caller must BE that user.
 *   - Page entity: caller must have ADMIN or EDITOR on the page.
 *   - Anything else (entity has neither, or both null): refuse.
 *
 * Accepts the partial-include shape from `findEntityByHandle`, which
 * populates exactly one of `user` / `page`.
 */
export async function canManageEntity(
  userId: string,
  entity: { user?: User | null; page?: Page | null },
): Promise<boolean> {
  if (entity.user) return entity.user.id === userId;
  if (entity.page) {
    return hasPermission(
      userId,
      entity.page.id,
      ResourceType.PAGE,
      [PermissionRole.ADMIN, PermissionRole.EDITOR],
    );
  }
  return false;
}
