// ⚠️ SERVER-ONLY: Page utility functions
import { prisma } from "./prisma";
import { PermissionRole, ResourceType } from "@prisma/client";

import { profileElementFields } from "./profile-element";

export const publicPageFields = {
  id: true,
  createdByUserId: true,
  name: true,
  handle: true,
  headline: true,
  bio: true,
  interests: true,
  location: true,
  profileVisibility: true,
  contentVisibility: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  zip: true,
  category: true,
  tags: true,
  aboutContent: true,
  avatarImageId: true,
  avatarImage: { select: { url: true } },
  elements: { select: profileElementFields, where: { visible: true }, orderBy: { sortOrder: "asc" as const } },
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
    name?: string;
    headline?: string;
    bio?: string;
    interests?: string[];
    location?: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    category?: string | null;
    avatarImageId?: string | null;
    aboutContent?: string | null;
    profileVisibility?: import("@prisma/client").ProfileVisibility;
    contentVisibility?: import("@prisma/client").ContentVisibility;
  },
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) updateData[key] = value;
  }

  return ((tx ?? prisma) as typeof prisma).page.update({
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
 * The handle is lowercased here (canonical storage form — INV-7). Caller is still
 * responsible for:
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
  // Handles are always stored lowercase (INV-7) — canonicalize here, not at the caller.
  const handle = data.handle.toLowerCase();
  return prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        createdByUserId: userId,
        name: data.name.trim(),
        handle,
        headline: data.headline?.trim() || null,
        bio: data.bio?.trim() || null,
        interests: data.interests || [],
        location: data.location?.trim() || null,
        // New pages default to open distribution; explicit since the column no longer
        // carries a DB default.
        contentVisibility: "LISTED",
        handleRecord: { create: { handle } },
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
