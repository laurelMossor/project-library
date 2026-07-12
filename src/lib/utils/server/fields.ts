// ⚠️ SERVER-ONLY: Reusable field selection objects for Prisma queries
import { Prisma } from "@prisma/client";
import { publicUserEmbedFields } from "./user";

/**
 * Attribution-only fields for embedding a page on OTHER content (a post's/event's
 * hosting page). Excludes a page's bio/interests/location/visibility so a non-public
 * page's details don't ride along on content. Mirrors publicUserEmbedFields and is
 * covered by the same embed-selector test guard.
 */
export const publicPageEmbedFields = {
  id: true,
  name: true,
  handle: true,
  avatarImageId: true,
  avatarImage: { select: { url: true } },
} as const;

export const imageFields = {
  id: true,
  url: true,
  path: true,
  altText: true,
  caption: true,
  uploadedByUserId: true,
  createdAt: true,
} as const;

export const imageAttachmentFields = {
  id: true,
  imageId: true,
  type: true,
  targetId: true,
  sortOrder: true,
  createdAt: true,
} as const;

export const imagesRelationFields = {
  select: imageFields,
} as const;

/** Standard fields for Event with user and page info */
export const eventBaseFields = {
  id: true,
  userId: true,
  pageId: true,
  title: true,
  content: true,
  eventDateTime: true,
  eventTimezone: true,
  location: true,
  latitude: true,
  longitude: true,
  status: true,
  contentVisibility: true,
  pinnedAt: true,
  tags: true,
  topics: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const eventWithUserFields = {
  ...eventBaseFields,
  user: {
    select: publicUserEmbedFields,
  },
  page: {
    select: publicPageEmbedFields,
  },
} as const;

/** Event fields for collection views — includes update count and most recent update */
export const eventCollectionFields = {
  ...eventWithUserFields,
  // updates count is PUBLISHED-only; comments have no status, so count them all.
  _count: { select: { updates: { where: { status: "PUBLISHED" as const } }, comments: true } },
  updates: {
    where: { status: "PUBLISHED" as const },
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
    },
  },
};

// ========================
// Prisma-derived types (schema as source of truth)
// ========================

/** Event shape as returned by eventWithUserFields query (without images/type - those are added separately) */
export type EventFromQuery = Prisma.EventGetPayload<{ select: typeof eventWithUserFields }>;

/** Standard fields for Post with user and page info */
export const postBaseFields = {
  id: true,
  userId: true,
  pageId: true,
  eventId: true,
  parentPostId: true,
  title: true,
  content: true,
  status: true,
  contentVisibility: true,
  pinnedAt: true,
  tags: true,
  topics: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const postWithUserFields = {
  ...postBaseFields,
  user: {
    select: publicUserEmbedFields,
  },
  page: {
    select: publicPageEmbedFields,
  },
  event: {
    select: {
      id: true,
      title: true,
    },
  },
  parentPost: {
    select: {
      id: true,
      title: true,
    },
  },
} as const;

/** Post fields for collection views — includes update count and most recent update */
export const postCollectionFields = {
  ...postWithUserFields,
  // updates count is PUBLISHED-only; comments have no status, so count them all.
  _count: { select: { updates: { where: { status: "PUBLISHED" as const } }, comments: true } },
  updates: {
    where: { status: "PUBLISHED" as const },
    take: 1,
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
    },
  },
};

/** Post shape as returned by postWithUserFields query */
export type PostFromQuery = Prisma.PostGetPayload<{ select: typeof postWithUserFields }>;

/**
 * Comment with attribution embeds. `author` is always the human; `asPage` is set when the
 * comment was made "as" a page. Both use the attribution-only selectors so a private
 * profile/page's details never ride along on a comment (VISIBILITY_RULES §8).
 */
export const commentWithAuthorFields = {
  id: true,
  authorId: true,
  asPageId: true,
  postId: true,
  eventId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: publicUserEmbedFields,
  },
  asPage: {
    select: publicPageEmbedFields,
  },
} as const;

/** Comment shape as returned by commentWithAuthorFields query */
export type CommentFromQuery = Prisma.CommentGetPayload<{ select: typeof commentWithAuthorFields }>;

// ========================
// Collection card meta
// ========================

type RecentUpdate = { id: string; title: string | null; content: string; createdAt: Date };

/**
 * The card-meta half of a *CollectionFields query result: the engagement counts plus the
 * single most-recent update. Centralized so a new count (comments was the second) is one edit,
 * not one per collection fetcher. Callers strip `_count`/`updates` from their spread and merge
 * this in: `const { _count, updates, ...rest } = row; return { ...rest, ...toCollectionMeta(row) }`.
 */
export function toCollectionMeta(row: { _count: { updates: number; comments: number }; updates: RecentUpdate[] }) {
  return {
    _count: { updates: row._count.updates, comments: row._count.comments },
    recentUpdate: row.updates[0] ?? null,
  };
}
