// ⚠️ SERVER-ONLY: Reusable field selection objects for Prisma queries
import { Prisma } from "@prisma/client";
import { publicUserFields } from "./user";

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
  location: true,
  latitude: true,
  longitude: true,
  status: true,
  pinnedAt: true,
  tags: true,
  topics: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const eventWithUserFields = {
  ...eventBaseFields,
  user: {
    select: publicUserFields,
  },
  page: {
    select: {
      id: true,
      name: true,
      slug: true,
      headline: true,
      bio: true,
      interests: true,
      location: true,
      avatarImageId: true,
      avatarImage: { select: { url: true } },
    },
  },
} as const;

/** Event fields for collection views — includes update count and most recent update */
export const eventCollectionFields = {
  ...eventWithUserFields,
  _count: { select: { updates: true } },
  updates: {
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
  pinnedAt: true,
  tags: true,
  topics: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const postWithUserFields = {
  ...postBaseFields,
  user: {
    select: publicUserFields,
  },
  page: {
    select: {
      id: true,
      name: true,
      slug: true,
      avatarImageId: true,
      avatarImage: { select: { url: true } },
    },
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
  _count: { select: { updates: true } },
  updates: {
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
