// ⚠️ SERVER-ONLY: Page utility functions
import { prisma } from "./prisma";
import { PermissionRole, ResourceType } from "@prisma/client";

export const publicPageFields = {
  id: true,
  createdByUserId: true,
  name: true,
  slug: true,
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
  createdAt: true,
  updatedAt: true,
} as const;

export async function getPageBySlug(slug: string) {
  return prisma.page.findUnique({
    where: { slug },
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

export async function createPage(
  userId: string,
  data: {
    name: string;
    slug: string;
    headline?: string;
    bio?: string;
    interests?: string[];
    location?: string;
  }
) {
  const existingPage = await prisma.page.findUnique({
    where: { slug: data.slug },
  });
  if (existingPage) {
    throw new Error("A page with this slug already exists");
  }

  return prisma.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        createdByUserId: userId,
        name: data.name.trim(),
        slug: data.slug.trim(),
        headline: data.headline?.trim() || null,
        bio: data.bio?.trim() || null,
        interests: data.interests || [],
        location: data.location?.trim() || null,
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
