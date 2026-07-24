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

import { ContentVisibility, ProfileVisibility } from "@prisma/client";
import { prisma } from "./prisma";
import { getSessionContext } from "./session";
import { canActAsEntity, getMemberPageIds } from "./permission";

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

  return {
    userId: session.userId,
    memberPageIds: await getMemberPageIds(session.userId),
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
 * Two-state profile access for the SSR dispatcher (the caller has already resolved existence).
 *
 *   FULL   → viewer may see the whole profile (PUBLIC, owner, or edge)
 *   LOCKED → profile is PRIVATE and the viewer lacks an edge → render an identity-only stub with a
 *            request affordance (NOT content). Applies to anonymous viewers too, since PRIVATE
 *            profiles are discoverable in search — the stub reveals nothing beyond what search shows.
 *
 * There is no HIDDEN state: a PUBLIC profile is always FULL, so the only non-FULL case is a PRIVATE
 * profile without an edge (→ LOCKED). Existence-deny is the caller's job (it 404s a missing entity
 * before calling this).
 */
export type ProfileAccess = "FULL" | "LOCKED";

export async function resolveProfileAccess(
  kind: ProfileKind,
  entity: { id: string; profileVisibility: ProfileVisibility },
  viewer: ViewerContext,
): Promise<ProfileAccess> {
  if (await canViewProfile(kind, entity, viewer)) return "FULL";
  return "LOCKED";
}

/** Check if the viewer can see an Event entity (reads the event's derived visibility). */
export async function canViewEvent(
  event: { id: string; userId: string; pageId: string | null; contentVisibility: ContentVisibility },
  viewer: ViewerContext,
): Promise<boolean> {
  if (event.contentVisibility !== ContentVisibility.PRIVATE) return true;
  return canViewByOwnerEdge(event.userId, event.pageId, viewer);
}

/** Check if the viewer can see a Post entity (reads the post's derived visibility). */
export async function canViewPost(
  post: {
    id: string;
    userId: string;
    pageId: string | null;
    eventId: string | null;
    contentVisibility: ContentVisibility;
  },
  viewer: ViewerContext,
): Promise<boolean> {
  if (post.contentVisibility !== ContentVisibility.PRIVATE) return true;
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

/**
 * Is the viewer the "owner" of this content for gating purposes — its author, or a
 * manager (ADMIN/EDITOR) of the hosting page? Plain page MEMBERs are NOT owners. This is
 * the single source for the DRAFT-visibility rule so a page admin sees co-authored drafts
 * (finding 8) while a stranger does not.
 */
export async function isContentOwner(
  viewer: ViewerContext,
  content: { userId: string; pageId: string | null },
): Promise<boolean> {
  if (!viewer.userId) return false;
  if (content.pageId) return canActAsEntity(viewer.userId, { page: { id: content.pageId } });
  return viewer.userId === content.userId;
}

type ViewableEvent = {
  id: string;
  userId: string;
  pageId: string | null;
  status: "DRAFT" | "PUBLISHED";
  contentVisibility: ContentVisibility;
};

/**
 * Fetch an Event by id and gate it in one step: DRAFT events are visible only to their owner
 * (author or page manager), and non-owners must pass the content visibility gate. Returns the
 * event when viewable, or `null` when missing OR not viewable (both → 404, so the route can't
 * be used as an existence oracle). De-dups the fetch+gate boilerplate across the event routes.
 */
export async function requireViewableEvent(
  id: string,
  viewer: ViewerContext,
): Promise<ViewableEvent | null> {
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, userId: true, pageId: true, status: true, contentVisibility: true },
  });
  if (!event) return null;
  if (event.status === "DRAFT" && !(await isContentOwner(viewer, event))) return null;
  if (!(await canViewEvent(event, viewer))) return null;
  return event;
}

type ViewablePost = {
  id: string;
  userId: string;
  pageId: string | null;
  eventId: string | null;
  parentPostId: string | null;
  status: "DRAFT" | "PUBLISHED";
  contentVisibility: ContentVisibility;
};

/**
 * Fetch a Post by id and gate it in one step (mirror of requireViewableEvent): DRAFT posts are
 * visible only to their owner; non-owners must pass the content gate. Returns the post or `null`
 * (missing OR not viewable → 404).
 */
export async function requireViewablePost(
  id: string,
  viewer: ViewerContext,
): Promise<ViewablePost | null> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, userId: true, pageId: true, eventId: true, parentPostId: true, status: true, contentVisibility: true },
  });
  if (!post) return null;
  if (post.status === "DRAFT" && !(await isContentOwner(viewer, post))) return null;
  if (!(await canViewPost(post, viewer))) return null;
  return post;
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
  const listedClause = { contentVisibility: { in: FEED_VISIBILITY } };
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
  const listedClause = { contentVisibility: { in: FEED_VISIBILITY } };
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
  return { contentVisibility: { in: PROFILE_COLLECTION_VISIBILITY } };
}

// ---------------------------------------------------------------------------
// Inheritance — the content visibility a newly-created child adopts from its parent.
// ---------------------------------------------------------------------------

/**
 * Resolve the content visibility a new post/event should inherit from its parent:
 * page → event → parentPost → user → LISTED. The first matching parent wins, so an update
 * to a PRIVATE parent post is born PRIVATE even when its author's profile default is LISTED
 * (finding 5). Never widens: it copies the parent's stored value verbatim.
 */
export async function resolveParentVisibility(
  userId: string,
  pageId?: string | null,
  eventId?: string | null,
  parentPostId?: string | null,
): Promise<ContentVisibility> {
  if (pageId) {
    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { contentVisibility: true } });
    return page?.contentVisibility ?? ContentVisibility.LISTED;
  }
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { contentVisibility: true } });
    return event?.contentVisibility ?? ContentVisibility.LISTED;
  }
  if (parentPostId) {
    const parent = await prisma.post.findUnique({ where: { id: parentPostId }, select: { contentVisibility: true } });
    return parent?.contentVisibility ?? ContentVisibility.LISTED;
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
  parentType: "USER" | "PAGE" | "EVENT" | "POST",
  parentId: string,
  newVisibility: ContentVisibility,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
): Promise<void> {
  const client = (tx ?? prisma) as typeof prisma;
  const data = { contentVisibility: newVisibility };

  switch (parentType) {
    case "PAGE": {
      // Direct page posts (and their replies — a reply shares its parent's pageId, INV-3).
      await client.post.updateMany({ where: { pageId: parentId }, data });
      const events = await client.event.findMany({
        where: { pageId: parentId },
        select: { id: true },
      });
      await client.event.updateMany({ where: { pageId: parentId }, data });
      if (events.length > 0) {
        const eventIds = events.map((e) => e.id);
        // Posts attached to the page's events, plus replies to those posts (pageId null).
        await client.post.updateMany({ where: { eventId: { in: eventIds } }, data });
        await client.post.updateMany({ where: { parentPost: { eventId: { in: eventIds } } }, data });
      }
      break;
    }
    case "USER": {
      // Only standalone content (no page/event context). parentPostId:null keeps this from
      // grabbing replies to page/event posts, which the PAGE/EVENT branches own.
      await client.post.updateMany({
        where: { userId: parentId, pageId: null, eventId: null, parentPostId: null },
        data,
      });
      // Replies to the user's own standalone posts (a reply carries pageId null, so the clause
      // above would otherwise sweep in replies to page/event posts too — hence the parentPost filter).
      await client.post.updateMany({
        where: { parentPost: { userId: parentId, pageId: null, eventId: null } },
        data,
      });
      const events = await client.event.findMany({
        where: { userId: parentId, pageId: null },
        select: { id: true },
      });
      await client.event.updateMany({ where: { userId: parentId, pageId: null }, data });
      if (events.length > 0) {
        const eventIds = events.map((e) => e.id);
        await client.post.updateMany({ where: { eventId: { in: eventIds } }, data });
        await client.post.updateMany({ where: { parentPost: { eventId: { in: eventIds } } }, data });
      }
      break;
    }
    case "EVENT":
      // Posts on the event, plus replies to those posts.
      await client.post.updateMany({ where: { eventId: parentId }, data });
      await client.post.updateMany({ where: { parentPost: { eventId: parentId } }, data });
      break;
    case "POST":
      // Replies to a single post (updates cannot nest, so one level is complete).
      await client.post.updateMany({ where: { parentPostId: parentId }, data });
      break;
  }
}
