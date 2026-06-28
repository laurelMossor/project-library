// ⚠️ SERVER-ONLY: Visibility enforcement layer
//
// One source of truth for the three-tier model (PUBLIC / UNLISTED / PRIVATE).
// Users and pages are treated the same wherever possible — one parametrized
// utility per concern, backed by shared relationship primitives — so a rule
// change can't be applied to one entity type and missed on another.
//
//   Relationship primitives   isFollower / isFollowingPage / isMember
//   Profile view gate         canViewProfile(kind, entity, viewer)   (+ canViewEvent/canViewPost)
//   Route guard               requireViewableProfile(kind, id, viewer)
//   Global list filters       profileListWhere(kind) / eventListWhere / postListWhere
//   Own-collection filter     collectionVisibilityWhere(kind, id, viewer)
//   Cascade                   syncDescendantVisibility
//
// Access model: a PRIVATE entity is viewable by its owner OR a relationship edge —
// a *follow* for users, *follow OR membership* for pages. Do NOT scatter visibility
// checks into individual route handlers — add them here.

import { Visibility, ResourceType } from "@prisma/client";
import { prisma } from "./prisma";
import { getSessionContext } from "./session";

type ProfileKind = "USER" | "PAGE";

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

// ---------------------------------------------------------------------------
// Detail mode — single-entity gates. PUBLIC/UNLISTED pass; PRIVATE needs a
// relationship edge (or ownership).
// ---------------------------------------------------------------------------

/** Can the viewer see this profile (user or page)? */
export async function canViewProfile(
  kind: ProfileKind,
  entity: { id: string; visibility: Visibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (entity.visibility !== Visibility.PRIVATE) return true;
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
  user: { id: string; visibility: Visibility },
  viewer: ViewerContext,
): Promise<boolean> {
  return canViewProfile("USER", user, viewer);
}

/** Thin wrapper — see canViewProfile. */
export function canViewPage(
  page: { id: string; visibility: Visibility },
  viewer: ViewerContext,
): Promise<boolean> {
  return canViewProfile("PAGE", page, viewer);
}

/**
 * Tri-state profile access for the SSR dispatcher — one resolver for both User
 * and Page so the gate can't drift between entity types.
 *
 *   FULL    → viewer may see the whole profile (PUBLIC/UNLISTED, owner, or edge)
 *   LOCKED  → profile is PRIVATE, exists, and the viewer is logged-in but lacks an
 *             edge → render a header-only stub with a request affordance (NOT content)
 *   HIDDEN  → caller should `notFound()` (existence-deny)
 *
 * LOCKED only ever applies to PRIVATE, and only to a logged-in viewer: anonymous
 * viewers still get existence-deny (HIDDEN), since they can't request anyway and we
 * don't leak a private entity's identity to the public. UNLISTED always passes
 * canViewProfile when reached directly, so it resolves FULL.
 */
export type ProfileAccess = "FULL" | "LOCKED" | "HIDDEN";

export async function resolveProfileAccess(
  kind: ProfileKind,
  entity: { id: string; visibility: Visibility },
  viewer: ViewerContext,
): Promise<ProfileAccess> {
  if (await canViewProfile(kind, entity, viewer)) return "FULL";
  if (entity.visibility === Visibility.PRIVATE && viewer.userId) return "LOCKED";
  return "HIDDEN";
}

/** Check if the viewer can see an Event entity. */
export async function canViewEvent(
  event: { id: string; userId: string; pageId: string | null; visibility: Visibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (event.visibility !== Visibility.PRIVATE) return true;
  if (!viewer.userId) return false;
  if (viewer.userId === event.userId) return true;
  if (event.pageId) {
    if (isMember(viewer, event.pageId)) return true;
    return isFollowingPage(viewer.userId, event.pageId);
  }
  // Standalone (user-owned) event — visible to the owner's followers
  return isFollower(viewer.userId, event.userId);
}

/** Check if the viewer can see a Post entity (uses post.visibility directly). */
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
  if (post.pageId) {
    if (isMember(viewer, post.pageId)) return true;
    return isFollowingPage(viewer.userId, post.pageId);
  }
  if (post.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: post.eventId },
      select: { userId: true, pageId: true },
    });
    if (!event) return false;
    if (viewer.userId === event.userId) return true;
    if (event.pageId) {
      if (isMember(viewer, event.pageId)) return true;
      return isFollowingPage(viewer.userId, event.pageId);
    }
    return isFollower(viewer.userId, event.userId);
  }
  // Standalone (user-owned) post — visible to the owner's followers
  return isFollower(viewer.userId, post.userId);
}

/**
 * Fetch a profile by id and gate it in one step. Returns `{ id, visibility }`
 * when viewable, or `null` when missing OR not viewable (both → 404, so the
 * route never leaks existence). De-dups the fetch+gate+notFound boilerplate
 * across the profile/relationship routes.
 */
export async function requireViewableProfile(
  kind: ProfileKind,
  id: string,
  viewer: ViewerContext,
): Promise<{ id: string; visibility: Visibility } | null> {
  const entity =
    kind === "USER"
      ? await prisma.user.findUnique({ where: { id }, select: { id: true, visibility: true } })
      : await prisma.page.findUnique({ where: { id }, select: { id: true, visibility: true } });
  if (!entity) return null;
  if (!(await canViewProfile(kind, entity, viewer))) return null;
  return entity;
}

// ---------------------------------------------------------------------------
// Global list mode — feeds, search. Returns PUBLIC content plus the viewer's
// own. UNLISTED and PRIVATE are never surfaced in global lists.
// ---------------------------------------------------------------------------

/** Prisma where fragment for profile (user/page) list/search queries. */
export function profileListWhere(kind: ProfileKind, viewer: ViewerContext) {
  const publicClause = { visibility: Visibility.PUBLIC };
  if (!viewer.userId) return publicClause;
  if (kind === "USER") return { OR: [publicClause, { id: viewer.userId }] };
  return { OR: [publicClause, { id: { in: viewer.memberPageIds } }] };
}

/** Prisma where fragment for Event list queries. */
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

/** Prisma where fragment for Post list queries (combined with status filter by caller). */
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
// Own-collection mode — a single entity's own profile/page collection.
// Distinct from global feeds: anyone who reached the entity sees its
// PUBLIC + UNLISTED content; owner / follower (user) / member-or-follower (page)
// also see PRIVATE.
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
 * `{}` (no restriction) when the viewer may see PRIVATE; otherwise PUBLIC+UNLISTED.
 * Single source of truth for the four getX-by-Y collection functions.
 */
export async function collectionVisibilityWhere(
  kind: ProfileKind,
  id: string,
  viewer?: ViewerContext,
): Promise<object> {
  if (await maySeePrivateOf(kind, id, viewer)) return {};
  return { visibility: { in: [Visibility.PUBLIC, Visibility.UNLISTED] } };
}

// ---------------------------------------------------------------------------
// Inheritance — the visibility a newly-created child should adopt from its parent.
// ---------------------------------------------------------------------------

/** Resolve the visibility a new post/event should inherit: page → event → user → PUBLIC. */
export async function resolveParentVisibility(
  userId: string,
  pageId?: string | null,
  eventId?: string | null,
): Promise<Visibility> {
  if (pageId) {
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { visibility: true } });
    return page?.visibility ?? Visibility.PUBLIC;
  }
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { visibility: true } });
    return event?.visibility ?? Visibility.PUBLIC;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { visibility: true } });
  return user?.visibility ?? Visibility.PUBLIC;
}

// ---------------------------------------------------------------------------
// Cascade — keep descendant Post/Event visibility in step with a parent change.
// Call inside the same transaction as the parent update.
// ---------------------------------------------------------------------------

/**
 * Sync descendant visibility when a parent User/Page/Event changes visibility.
 * Covers child posts AND child events (and posts attached to those events).
 * Pass `tx` when inside a Prisma transaction; otherwise uses the global client.
 */
export async function syncDescendantVisibility(
  parentType: "USER" | "PAGE" | "EVENT",
  parentId: string,
  newVisibility: Visibility,
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
