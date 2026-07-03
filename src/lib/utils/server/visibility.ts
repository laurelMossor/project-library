// ⚠️ SERVER-ONLY: Visibility enforcement layer
//
// One source of truth for the model. Two INDEPENDENT sibling concerns:
//   profileVisibility  PUBLIC | PRIVATE            — who can find/enter a profile
//   contentVisibility  LISTED | UNLISTED | PRIVATE — where a post/event surfaces
// Post/Event carry a derived `visibility` (ContentVisibility) inherited from the owner's
// contentVisibility; it is never client-set. Enforcement is content-authoritative: content
// gates read the content's own visibility, so the profile's privacy does not re-gate
// already-created content at runtime (leaving room for a future per-item override).
//
//   Relationship primitives   isFollower / isFollowingPage / isMember / canViewByOwnerEdge
//   Profile view gate         canViewProfile(kind, entity, viewer)   (+ resolveProfileAccess)
//   Content view gate         canViewEvent / canViewPost
//   Route guard               requireViewableProfile(kind, id, viewer)
//   Global list filters       profileListWhere / eventListWhere / postListWhere
//   Own-collection filter     collectionVisibilityWhere(kind, id, viewer)
//   Inheritance / cascade     resolveParentVisibility / syncDescendantVisibility
//
// Do NOT scatter visibility checks into individual route handlers — add them here.

import { ContentVisibility, ProfileVisibility, ResourceType } from "@prisma/client";
import { prisma } from "./prisma";
import { getSessionContext } from "./session";

type ProfileKind = "USER" | "PAGE";

// Content that appears in global feeds / collections. Single source so the list filters
// below can't drift from each other.
export const FEED_VISIBILITY: ContentVisibility[] = [ContentVisibility.LISTED];
export const PROFILE_COLLECTION_VISIBILITY: ContentVisibility[] = [
  ContentVisibility.LISTED,
  ContentVisibility.UNLISTED,
];

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
// Relationship primitives — the single source of truth for "who is related"
// ---------------------------------------------------------------------------

/** Does `viewerId` follow user `userId`? */
export async function isFollower(viewerId: string, userId: string): Promise<boolean> {
  const follow = await prisma.follow.findFirst({
    where: { followerId: viewerId, followingUserId: userId },
    select: { id: true },
  });
  return follow !== null;
}

/** Does `viewerId` follow page `pageId`? */
export async function isFollowingPage(viewerId: string, pageId: string): Promise<boolean> {
  const follow = await prisma.follow.findFirst({
    where: { followerId: viewerId, followingPageId: pageId },
    select: { id: true },
  });
  return follow !== null;
}

/** Does the viewer hold any Permission row (member/editor/admin) on `pageId`? */
export function isMember(viewer: ViewerContext, pageId: string): boolean {
  return viewer.memberPageIds.includes(pageId);
}

/**
 * May the viewer see PRIVATE content owned by `ownerUserId` (and optionally hosted by
 * `pageId`)? Owner, page member/follower (page-owned), or owner-follower (standalone).
 * Single source for the post/event edge check so the two gates can't drift.
 */
async function canViewByOwnerEdge(
  ownerUserId: string,
  pageId: string | null,
  viewer: ViewerContext,
): Promise<boolean> {
  if (!viewer.userId) return false;
  if (viewer.userId === ownerUserId) return true;
  if (pageId) {
    if (isMember(viewer, pageId)) return true;
    return isFollowingPage(viewer.userId, pageId);
  }
  return isFollower(viewer.userId, ownerUserId);
}

// ---------------------------------------------------------------------------
// Detail mode — single-entity gates.
// ---------------------------------------------------------------------------

/** Can the viewer see this profile (user or page)? PUBLIC always; PRIVATE needs owner/edge. */
export async function canViewProfile(
  kind: ProfileKind,
  entity: { id: string; profileVisibility: ProfileVisibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (entity.profileVisibility !== ProfileVisibility.PRIVATE) return true;
  if (!viewer.userId) return false;
  if (kind === "USER") {
    if (viewer.userId === entity.id) return true;
    return isFollower(viewer.userId, entity.id);
  }
  // PAGE — membership or a follow edge grants access
  if (isMember(viewer, entity.id)) return true;
  return isFollowingPage(viewer.userId, entity.id);
}

/** Thin wrapper — see canViewProfile. */
export function canViewUser(
  user: { id: string; profileVisibility: ProfileVisibility },
  viewer: ViewerContext,
): Promise<boolean> {
  return canViewProfile("USER", user, viewer);
}

/** Thin wrapper — see canViewProfile. */
export function canViewPage(
  page: { id: string; profileVisibility: ProfileVisibility },
  viewer: ViewerContext,
): Promise<boolean> {
  return canViewProfile("PAGE", page, viewer);
}

/**
 * Tri-state profile access for the SSR dispatcher.
 *
 *   FULL    → viewer may see the whole profile (PUBLIC, owner, or edge)
 *   LOCKED  → profile is PRIVATE and the viewer lacks an edge → render an identity-only stub
 *             with a request affordance (NOT content). Applies to anonymous viewers too, since
 *             PRIVATE profiles are discoverable in search — the stub reveals nothing beyond
 *             what search already shows.
 *   HIDDEN  → caller should notFound() (only reached for a genuinely missing entity).
 */
export type ProfileAccess = "FULL" | "LOCKED" | "HIDDEN";

export async function resolveProfileAccess(
  kind: ProfileKind,
  entity: { id: string; profileVisibility: ProfileVisibility },
  viewer: ViewerContext,
): Promise<ProfileAccess> {
  if (await canViewProfile(kind, entity, viewer)) return "FULL";
  if (entity.profileVisibility === ProfileVisibility.PRIVATE) return "LOCKED";
  return "HIDDEN";
}

/** Check if the viewer can see an Event entity (reads the event's derived visibility). */
export async function canViewEvent(
  event: { id: string; userId: string; pageId: string | null; visibility: ContentVisibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (event.visibility !== ContentVisibility.PRIVATE) return true;
  return canViewByOwnerEdge(event.userId, event.pageId, viewer);
}

/** Check if the viewer can see a Post entity (reads the post's derived visibility). */
export async function canViewPost(
  post: {
    id: string;
    userId: string;
    pageId: string | null;
    eventId: string | null;
    visibility: ContentVisibility;
  },
  viewer: ViewerContext,
): Promise<boolean> {
  if (post.visibility !== ContentVisibility.PRIVATE) return true;
  if (!viewer.userId) return false;
  // Event-attached posts inherit the event's owner/page edge.
  if (post.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: post.eventId },
      select: { userId: true, pageId: true },
    });
    if (!event) return false;
    return canViewByOwnerEdge(event.userId, event.pageId, viewer);
  }
  return canViewByOwnerEdge(post.userId, post.pageId, viewer);
}

/**
 * Fetch a profile by id and gate it in one step. Returns `{ id, profileVisibility }` when
 * viewable, or `null` when missing OR not viewable (both → 404, so the route never leaks
 * existence). De-dups the fetch+gate+notFound boilerplate across the profile/relationship routes.
 */
export async function requireViewableProfile(
  kind: ProfileKind,
  id: string,
  viewer: ViewerContext,
): Promise<{ id: string; profileVisibility: ProfileVisibility } | null> {
  const entity =
    kind === "USER"
      ? await prisma.user.findUnique({ where: { id }, select: { id: true, profileVisibility: true } })
      : await prisma.page.findUnique({ where: { id }, select: { id: true, profileVisibility: true } });
  if (!entity) return null;
  if (!(await canViewProfile(kind, entity, viewer))) return null;
  return entity;
}

// ---------------------------------------------------------------------------
// Global list mode — feeds, search.
// ---------------------------------------------------------------------------

/**
 * Prisma where fragment for profile (user/page) list/search queries.
 * Both PUBLIC and PRIVATE profiles are discoverable — PRIVATE renders as an identity-only
 * stub (see the search field trim + LOCKED stub), so there is no visibility restriction here.
 */
export function profileListWhere(_kind: ProfileKind, _viewer: ViewerContext) {
  return {};
}

/** Prisma where fragment for Event list queries. Only LISTED content, plus the viewer's own. */
export function eventListWhere(viewer: ViewerContext) {
  const listedClause = { visibility: { in: FEED_VISIBILITY } };
  if (!viewer.userId) return listedClause;
  return {
    OR: [
      listedClause,
      { userId: viewer.userId },
      ...(viewer.memberPageIds.length > 0
        ? [{ pageId: { in: viewer.memberPageIds } }]
        : []),
    ],
  };
}

/** Prisma where fragment for Post list queries (combined with status filter by caller). */
export function postListWhere(viewer: ViewerContext) {
  const listedClause = { visibility: { in: FEED_VISIBILITY } };
  if (!viewer.userId) return listedClause;
  return {
    OR: [
      listedClause,
      { userId: viewer.userId },
      ...(viewer.memberPageIds.length > 0
        ? [{ pageId: { in: viewer.memberPageIds } }]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Own-collection mode — a single entity's own profile/page collection.
// Anyone who reached the entity sees its LISTED + UNLISTED content; owner / follower (user) /
// member-or-follower (page) also see PRIVATE.
// ---------------------------------------------------------------------------

/** True if the viewer may see PRIVATE content belonging to this profile. */
async function maySeePrivateOf(
  kind: ProfileKind,
  id: string,
  viewer?: ViewerContext,
): Promise<boolean> {
  if (!viewer?.userId) return false;
  if (kind === "USER") {
    return viewer.userId === id || isFollower(viewer.userId, id);
  }
  return isMember(viewer, id) || isFollowingPage(viewer.userId, id);
}

/**
 * Prisma visibility fragment for an entity's OWN collection query.
 * `{}` (no restriction) when the viewer may see PRIVATE; otherwise LISTED + UNLISTED.
 */
export async function collectionVisibilityWhere(
  kind: ProfileKind,
  id: string,
  viewer?: ViewerContext,
): Promise<object> {
  if (await maySeePrivateOf(kind, id, viewer)) return {};
  return { visibility: { in: PROFILE_COLLECTION_VISIBILITY } };
}

// ---------------------------------------------------------------------------
// Inheritance — the content visibility a newly-created child adopts from its parent.
// ---------------------------------------------------------------------------

/** Resolve the visibility a new post/event should inherit: page → event → user → LISTED. */
export async function resolveParentVisibility(
  userId: string,
  pageId?: string | null,
  eventId?: string | null,
): Promise<ContentVisibility> {
  if (pageId) {
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { contentVisibility: true } });
    return page?.contentVisibility ?? ContentVisibility.LISTED;
  }
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { visibility: true } });
    return event?.visibility ?? ContentVisibility.LISTED;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { contentVisibility: true } });
  return user?.contentVisibility ?? ContentVisibility.LISTED;
}

// ---------------------------------------------------------------------------
// Cascade — keep descendant Post/Event visibility in step with a parent change.
// Call inside the same transaction as the parent update. Pass the already-derived value.
// ---------------------------------------------------------------------------

/**
 * Sync descendant visibility when a parent User/Page/Event changes content visibility.
 * Covers child posts AND child events (and posts attached to those events).
 * Pass `tx` when inside a Prisma transaction; otherwise uses the global client.
 */
export async function syncDescendantVisibility(
  parentType: "USER" | "PAGE" | "EVENT",
  parentId: string,
  newVisibility: ContentVisibility,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const client = (tx ?? prisma) as typeof prisma;
  const data = { visibility: newVisibility };

  switch (parentType) {
    case "PAGE": {
      await client.post.updateMany({ where: { pageId: parentId }, data });
      const events = await client.event.findMany({
        where: { pageId: parentId },
        select: { id: true },
      });
      await client.event.updateMany({ where: { pageId: parentId }, data });
      if (events.length > 0) {
        await client.post.updateMany({
          where: { eventId: { in: events.map((e) => e.id) } },
          data,
        });
      }
      break;
    }
    case "USER": {
      // Only standalone content (no page context)
      await client.post.updateMany({
        where: { userId: parentId, pageId: null, eventId: null },
        data,
      });
      const events = await client.event.findMany({
        where: { userId: parentId, pageId: null },
        select: { id: true },
      });
      await client.event.updateMany({ where: { userId: parentId, pageId: null }, data });
      if (events.length > 0) {
        await client.post.updateMany({
          where: { eventId: { in: events.map((e) => e.id) } },
          data,
        });
      }
      break;
    }
    case "EVENT":
      await client.post.updateMany({ where: { eventId: parentId }, data });
      break;
  }
}
