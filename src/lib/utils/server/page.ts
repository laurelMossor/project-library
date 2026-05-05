// ⚠️ SERVER-ONLY: Page utility functions
import { prisma } from "./prisma";
import { PermissionRole, ResourceType } from "@prisma/client";

export const publicPageFields = {
  id: true,
  createdByUserId: true,
  name: true,
  handle: true,
  headline: true,
  bio: true,
  interests: true,
  location: true,
  visibility: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  zip: true,
  parentTopic: true,
  tags: true,
  isOpenToCollaborators: true,
  avatarImageId: true,
  avatarImage: { select: { url: true } },
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Fetch a Page by handle (formerly `slug` — renamed in PR 2).
 *
 * For routes that need to resolve EITHER a User or a Page from the same
 * `/[handle]` URL, use `findEntityByHandle` from `@/lib/utils/server/handle`.
 * This function is Page-only and is kept for callers that specifically need
 * the page row (e.g. server-side fetches where the type is known).
 */
export async function getPageByHandle(handle: string) {
  return prisma.page.findUnique({
    where: { handle },
    select: publicPageFields,
  });
}

export async function getPageById(id: string) {
  return prisma.page.findUnique({
    where: { id },
    select: publicPageFields,
  });
}

export async function updatePageProfile(
  pageId: string,
  data: {
    headline?: string;
    bio?: string;
    interests?: string[];
    location?: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    parentTopic?: string | null;
    avatarImageId?: string | null;
    isOpenToCollaborators?: boolean;
  }
) {
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updateData[key] = value;
  }

  return prisma.page.update({
    where: { id: pageId },
    data: updateData,
    select: publicPageFields,
  });
}

/**
 * Create a new Page (with companion Handle row + creator ADMIN permission).
 *
 * All three writes happen inside a single `$transaction`:
 *   1. Page (with nested `handleRecord: { create }` — atomic at driver layer)
 *   2. Permission (creator gets ADMIN role for the new page)
 *
 * Caller is responsible for:
 *   - Lowercasing `handle` (per PR 2 normalization rule).
 *   - Running `validateHandle` + `isReservedHandle` + `isHandleTaken` first.
 *
 * Race condition handling: if a concurrent caller wins the handle between
 * `isHandleTaken` and this write, Prisma throws `P2002` on the unique
 * constraint. The API route catches and surfaces as "handle already taken."
 */
export async function createPage(
  userId: string,
  data: {
    name: string;
    handle: string;
    headline?: string;
    bio?: string;
    interests?: string[];
    location?: string;
  }
) {
  return prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        createdByUserId: userId,
        name: data.name.trim(),
        handle: data.handle,
        headline: data.headline?.trim() || null,
        bio: data.bio?.trim() || null,
        interests: data.interests || [],
        location: data.location?.trim() || null,
        handleRecord: { create: { handle: data.handle } },
      },
      select: publicPageFields,
    });

    // Auto-create ADMIN permission for creator
    await tx.permission.create({
      data: {
        userId,
        resourceId: page.id,
        resourceType: ResourceType.PAGE,
        role: PermissionRole.ADMIN,
      },
    });

    return page;
  });
}
