// ⚠️ SERVER-ONLY: Visibility enforcement layer
//
// Two modes:
//   listVisibilityWhere  — Prisma where fragment for list/feed queries (PUBLIC + own only)
//   canViewDetail        — boolean gate for single-entity detail routes (PUBLIC/UNLISTED pass; PRIVATE requires relationship)
//
// All visibility enforcement in the app routes through one of these two functions.
// Do NOT scatter visibility checks into individual route handlers — add them here.

import { Visibility, ResourceType, PermissionRole } from "@prisma/client";
import { prisma } from "./prisma";
import { getSessionContext } from "./session";

// ---------------------------------------------------------------------------
// Viewer context — built once per request, cheap
// ---------------------------------------------------------------------------

export type ViewerContext = {
  userId: string | null;
  /** pageIds where the viewer holds any Permission row (ADMIN/EDITOR/MEMBER) */
  memberPageIds: string[];
};

/** Build the viewer context for the current request. Call once at the top of a route handler. */
export async function getViewerContext(): Promise<ViewerContext> {
  const session = await getSessionContext();
  if (!session) return { userId: null, memberPageIds: [] };

  const permissions = await prisma.permission.findMany({
    where: { userId: session.userId, resourceType: ResourceType.PAGE },
    select: { resourceId: true },
  });

  return {
    userId: session.userId,
    memberPageIds: permissions.map((p) => p.resourceId),
  };
}

// ---------------------------------------------------------------------------
// List mode — for feeds, search, collection sections
// Returns content that is PUBLIC, plus the viewer's own content.
// Unlisted and Private are never surfaced in lists.
// ---------------------------------------------------------------------------

/** Prisma where fragment for User list queries */
export function userListWhere(viewer: ViewerContext) {
  const publicClause = { visibility: Visibility.PUBLIC };
  if (!viewer.userId) return publicClause;
  return { OR: [publicClause, { id: viewer.userId }] };
}

/** Prisma where fragment for Page list queries */
export function pageListWhere(viewer: ViewerContext) {
  const publicClause = { visibility: Visibility.PUBLIC };
  if (!viewer.userId) return publicClause;
  return {
    OR: [
      publicClause,
      { id: { in: viewer.memberPageIds } },
    ],
  };
}

/** Prisma where fragment for Event list queries */
export function eventListWhere(viewer: ViewerContext) {
  const publicClause = { visibility: Visibility.PUBLIC };
  if (!viewer.userId) return publicClause;
  return {
    OR: [
      publicClause,
      { userId: viewer.userId },
      ...(viewer.memberPageIds.length > 0
        ? [{ pageId: { in: viewer.memberPageIds } }]
        : []),
    ],
  };
}

/** Prisma where fragment for Post list queries (combined with status filter by caller) */
export function postListWhere(viewer: ViewerContext) {
  const publicClause = { visibility: Visibility.PUBLIC };
  if (!viewer.userId) return publicClause;
  return {
    OR: [
      publicClause,
      { userId: viewer.userId },
      ...(viewer.memberPageIds.length > 0
        ? [{ pageId: { in: viewer.memberPageIds } }]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Detail mode — for single-entity routes
// PUBLIC and UNLISTED are accessible to anyone.
// PRIVATE requires a relationship: follow (users) or membership (pages/events).
// ---------------------------------------------------------------------------

/** Check if the viewer can see a User entity */
export async function canViewUser(
  user: { id: string; visibility: Visibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (user.visibility !== Visibility.PRIVATE) return true;
  if (!viewer.userId) return false;
  if (viewer.userId === user.id) return true;

  // Check if viewer follows this user
  const follow = await prisma.follow.findFirst({
    where: { followerId: viewer.userId, followingUserId: user.id },
    select: { id: true },
  });
  return follow !== null;
}

/** Check if the viewer can see a Page entity */
export async function canViewPage(
  page: { id: string; visibility: Visibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (page.visibility !== Visibility.PRIVATE) return true;
  if (!viewer.userId) return false;
  // Any Permission row (member/editor/admin) grants access
  return viewer.memberPageIds.includes(page.id);
}

/** Check if the viewer can see an Event entity */
export async function canViewEvent(
  event: { id: string; userId: string; pageId: string | null; visibility: Visibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (event.visibility !== Visibility.PRIVATE) return true;
  if (!viewer.userId) return false;
  if (viewer.userId === event.userId) return true;
  // Member of hosting page
  if (event.pageId && viewer.memberPageIds.includes(event.pageId)) return true;
  return false;
}

/** Check if the viewer can see a Post entity (uses post.visibility directly) */
export async function canViewPost(
  post: {
    id: string;
    userId: string;
    pageId: string | null;
    eventId: string | null;
    visibility: Visibility;
  },
  viewer: ViewerContext,
): Promise<boolean> {
  if (post.visibility !== Visibility.PRIVATE) return true;
  if (!viewer.userId) return false;
  if (viewer.userId === post.userId) return true;
  if (post.pageId && viewer.memberPageIds.includes(post.pageId)) return true;
  // Event-owned post: check event's hosting page
  if (post.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: post.eventId },
      select: { userId: true, pageId: true },
    });
    if (event) {
      if (viewer.userId === event.userId) return true;
      if (event.pageId && viewer.memberPageIds.includes(event.pageId)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cascade sync — keep Post.visibility in step with parent visibility changes
// Call inside the same transaction as the parent update.
// ---------------------------------------------------------------------------

/**
 * Sync Post.visibility when a parent User/Page/Event changes visibility.
 * Pass `tx` if inside a Prisma transaction; otherwise uses the global prisma client.
 */
export async function syncChildPostVisibility(
  parentType: "USER" | "PAGE" | "EVENT",
  parentId: string,
  newVisibility: Visibility,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const client = tx ?? prisma;

  let where: object;
  switch (parentType) {
    case "USER":
      // Only standalone user posts (no page, no event context)
      where = { userId: parentId, pageId: null, eventId: null };
      break;
    case "PAGE":
      where = { pageId: parentId };
      break;
    case "EVENT":
      where = { eventId: parentId };
      break;
  }

  await (client as typeof prisma).post.updateMany({
    where,
    data: { visibility: newVisibility },
  });
}

// ---------------------------------------------------------------------------
// Page flip: Public → Private follower conversion
// When a page transitions to PRIVATE, convert existing followers to MEMBER permissions.
// Call inside the same transaction as the page update.
// ---------------------------------------------------------------------------

export async function convertFollowersToMembers(
  pageId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const client = (tx ?? prisma) as typeof prisma;

  // Find all user-followers of this page
  const follows = await client.follow.findMany({
    where: { followingPageId: pageId, followerPageId: null },
    select: { followerId: true },
  });

  if (follows.length === 0) return;

  // Upsert MEMBER permissions for each follower who doesn't already have one
  for (const { followerId } of follows) {
    if (!followerId) continue;
    await client.permission.upsert({
      where: {
        userId_resourceId_resourceType: {
          userId: followerId,
          resourceId: pageId,
          resourceType: ResourceType.PAGE,
        },
      },
      update: {}, // keep existing role if already a member/editor/admin
      create: {
        userId: followerId,
        resourceId: pageId,
        resourceType: ResourceType.PAGE,
        role: PermissionRole.MEMBER,
      },
    });
  }
}
