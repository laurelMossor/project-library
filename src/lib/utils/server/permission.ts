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
import { PermissionRole, ResourceType, type Page, type Prisma, type User } from "@prisma/client";
import { ACTING_ROLES, isActingRole, mayPostToPage } from "@/lib/const/roles";
import { DomainError } from "./domain-error";

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

/**
 * The caller's role on a page when they may act as it (ADMIN or EDITOR).
 * One permission read. Null for a member, or when they have no row.
 */
export async function getActingRole(userId: string, pageId: string): Promise<PermissionRole | null> {
  const role = await getUserPermission(userId, pageId, ResourceType.PAGE);
  return role && isActingRole(role) ? role : null;
}

/**
 * May this user post TO the page (their words, the page's collection)?
 * An acting role (ADMIN/EDITOR) may always. A MEMBER may only when the page
 * allows member posts. Posting AS the page is canPostAsPage, not this.
 * The decision itself is mayPostToPage; the acting-role branch skips the page read.
 */
export async function canPostToPage(userId: string, pageId: string): Promise<boolean> {
  const role = await getUserPermission(userId, pageId, ResourceType.PAGE);
  if (!role) return false;
  if (isActingRole(role)) return mayPostToPage(role, false);
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { allowMemberPosts: true },
  });
  return mayPostToPage(role, !!page?.allowMemberPosts);
}

type ContentAuthority = { userId: string; asPageId?: string | null; pageId?: string | null };

/**
 * May this user edit the content's words?
 * Page-spoken content (`asPageId` set) requires a current ADMIN/EDITOR of that page.
 * The human who clicked publish is not enough — losing the role loses the voice.
 * Personal posts and posts to a page (`asPageId` null) stay with the author.
 * A page editor cannot edit a member's post to the page.
 */
export async function canEditContent(userId: string, content: ContentAuthority): Promise<boolean> {
  if (content.asPageId) return canPostAsPage(userId, content.asPageId);
  return content.userId === userId;
}

/**
 * May this user delete the content or its comments? Editors, plus a manager of
 * the page the content lives on — so a page can remove a member's post without
 * being able to rewrite it.
 */
export async function canModerateContent(userId: string, content: ContentAuthority): Promise<boolean> {
  if (await canEditContent(userId, content)) return true;
  if (content.pageId) return canPostAsPage(userId, content.pageId);
  return false;
}

/** Check if user can manage a page (ADMIN only — page config / destructive actions). */
export async function canManagePage(userId: string, pageId: string): Promise<boolean> {
  return hasPermission(userId, pageId, ResourceType.PAGE, [PermissionRole.ADMIN]);
}

/** `canManagePage` as a guard for server utils behind Server Actions: refuses with a `forbidden` DomainError. */
export async function assertCanManagePage(userId: string, pageId: string): Promise<void> {
  if (!(await canManagePage(userId, pageId))) {
    throw new DomainError("You do not have permission to manage this page", "forbidden");
  }
}

/** True for a role that the self-service join/leave flow may set or clear (no role yet, or plain MEMBER). */
export function isSelfServiceRole(role: PermissionRole | null): boolean {
  return role === null || role === PermissionRole.MEMBER;
}

/** Count ADMIN permissions on a page. Pass `tx` to read inside the caller's transaction. */
export async function getAdminCount(pageId: string, tx: PermissionDb = prisma): Promise<number> {
  return tx.permission.count({
    where: { resourceId: pageId, resourceType: ResourceType.PAGE, role: PermissionRole.ADMIN },
  });
}

/**
 * Would removing OR demoting `targetUserId` leave the page with zero admins?
 * Single source of truth for the last-admin guard — used by member remove,
 * admin remove, role-change (demote), and self-leave. Returns false when the
 * target isn't currently an ADMIN (removing/demoting a MEMBER/EDITOR can't orphan).
 */
export async function wouldRemoveLastAdmin(
  pageId: string,
  targetUserId: string,
  tx: PermissionDb = prisma,
): Promise<boolean> {
  const targetRole = await getUserPermission(targetUserId, pageId, ResourceType.PAGE, tx);
  if (targetRole !== PermissionRole.ADMIN) return false;
  return (await getAdminCount(pageId, tx)) <= 1;
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

/**
 * The users who may act as each page (ADMIN/EDITOR), for many pages in one query — e.g. fanning a
 * message out to every manager of every page in a conversation. Pages with no managers are absent.
 */
export async function getActingManagerIdsByPage(pageIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (pageIds.length === 0) return map;
  const perms = await prisma.permission.findMany({
    where: { resourceId: { in: pageIds }, resourceType: ResourceType.PAGE, role: { in: [...ACTING_ROLES] } },
    select: { userId: true, resourceId: true },
  });
  for (const p of perms) {
    const list = map.get(p.resourceId) ?? [];
    list.push(p.userId);
    map.set(p.resourceId, list);
  }
  return map;
}

/** Get user's role on a resource */
export async function getUserPermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType,
  tx: PermissionDb = prisma,
): Promise<PermissionRole | null> {
  const permission = await tx.permission.findUnique({
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
      membershipPolicy: true,
      allowMemberPosts: true,
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
type PermissionDb = Prisma.TransactionClient | typeof prisma;

/**
 * Serialize admin grants, revokes, and page deletion for one page.
 * Reentrant inside the transaction that already holds it. A hash collision only
 * makes two unrelated pages wait on each other.
 */
export async function lockPageAdminChanges(pageId: string, tx: PermissionDb = prisma) {
  // $executeRaw, not $queryRaw: the lock function returns `void`, which $queryRaw can't deserialize.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('page-admins'), hashtext(${pageId}))`;
}

/** Grant a permission. Pass `tx` to run inside an existing transaction. */
export async function grantPermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType,
  role: PermissionRole,
  tx: PermissionDb = prisma,
) {
  if (resourceType === ResourceType.PAGE) await lockPageAdminChanges(resourceId, tx);
  return tx.permission.upsert({
    where: { userId_resourceId_resourceType: { userId, resourceId, resourceType } },
    update: { role },
    create: { userId, resourceId, resourceType, role },
  });
}

/** Revoke a permission. Pass `tx` to run inside the caller's transaction. */
export async function revokePermission(
  userId: string,
  resourceId: string,
  resourceType: ResourceType,
  tx: PermissionDb = prisma,
) {
  if (resourceType === ResourceType.PAGE) await lockPageAdminChanges(resourceId, tx);
  return tx.permission.deleteMany({
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

/**
 * Pages this user is the only ADMIN of, plus pages they created that have no admin left.
 * One groupBy finds the single-admin pages; the preview and the deletion both call this
 * so the confirm modal and the delete agree on what goes away.
 */
export async function getSoleAdminPages(userId: string, tx: PermissionDb = prisma) {
  const grouped = await tx.permission.groupBy({
    by: ["resourceId"],
    where: { resourceType: ResourceType.PAGE, role: PermissionRole.ADMIN },
    _max: { userId: true },
    having: { userId: { _count: { equals: 1 } } },
  });
  const soleIds = grouped.filter((g) => g._max.userId === userId).map((g) => g.resourceId);

  const created = await tx.page.findMany({
    where: { createdByUserId: userId, ...(soleIds.length ? { id: { notIn: soleIds } } : {}) },
    select: { id: true },
  });
  let zeroAdminIds: string[] = [];
  if (created.length > 0) {
    const withAdmins = await tx.permission.groupBy({
      by: ["resourceId"],
      where: {
        resourceId: { in: created.map((p) => p.id) },
        resourceType: ResourceType.PAGE,
        role: PermissionRole.ADMIN,
      },
    });
    const adminned = new Set(withAdmins.map((g) => g.resourceId));
    zeroAdminIds = created.filter((p) => !adminned.has(p.id)).map((p) => p.id);
  }

  const ids = [...soleIds, ...zeroAdminIds];
  if (ids.length === 0) return [];
  return tx.page.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, handle: true },
    orderBy: { name: "asc" },
  });
}

/** Earliest-granted remaining ADMIN on each page (Permission.createdAt, which promotion keeps). */
export async function getSuccessorAdminIds(
  pageIds: string[],
  excludeUserId: string,
  tx: PermissionDb,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (pageIds.length === 0) return map;
  const rows = await tx.permission.findMany({
    where: {
      resourceId: { in: pageIds },
      resourceType: ResourceType.PAGE,
      role: PermissionRole.ADMIN,
      userId: { not: excludeUserId },
    },
    orderBy: { createdAt: "asc" },
    select: { resourceId: true, userId: true },
  });
  for (const row of rows) {
    if (!map.has(row.resourceId)) map.set(row.resourceId, row.userId);
  }
  return map;
}

/** Permission.resourceId has no FK, so a page delete must drop its rows explicitly. */
export async function revokeAllForResource(pageId: string, tx: PermissionDb) {
  await tx.permission.deleteMany({ where: { resourceId: pageId } });
}
