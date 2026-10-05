// ⚠️ SERVER-ONLY: Page utility functions
import { prisma } from "./prisma";
import { AttachmentTarget, MembershipPolicy, PermissionRole, ResourceType, type ContentVisibility, type ProfileVisibility, type Prisma } from "@prisma/client";

import { profileElementFields } from "./profile-element";
import { grantPermission, lockPageAdminChanges, revokeAllForResource } from "./permission";
import { upsertFollow } from "./requests";
import { collectOrphanedImages, detachAllForTargets, avatarAssignmentError, AvatarNotAllowed } from "./image-attachment";

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
  membershipPolicy: true,
  allowMemberPosts: true,
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
    membershipPolicy?: MembershipPolicy;
    allowMemberPosts?: boolean;
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
    membershipPolicy?: MembershipPolicy;
    allowMemberPosts?: boolean;
    profileVisibility?: ProfileVisibility;
    contentVisibility?: ContentVisibility;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    avatarImageId?: string | null;
  }
) {
  // Handles are always stored lowercase (INV-7) — canonicalize here, not at the caller.
  const handle = data.handle.toLowerCase();
  // CLOSED has no members, so member posts can't be on. OPEN is rejected before this runs.
  const membershipPolicy = data.membershipPolicy ?? MembershipPolicy.CLOSED;
  const allowMemberPosts = membershipPolicy === MembershipPolicy.CLOSED ? false : (data.allowMemberPosts ?? false);
  return prisma.$transaction(async (tx) => {
    if (data.avatarImageId) {
      const avatarError = await avatarAssignmentError(userId, data.avatarImageId, null, tx);
      if (avatarError) throw new AvatarNotAllowed();
    }
    const page = await tx.page.create({
      data: {
        createdByUserId: userId,
        name: data.name.trim(),
        handle,
        headline: data.headline?.trim() || null,
        bio: data.bio?.trim() || null,
        interests: data.interests || [],
        location: data.location?.trim() || null,
        membershipPolicy,
        allowMemberPosts,
        // New pages default to open distribution; explicit since the column no longer
        // carries a DB default.
        contentVisibility: data.contentVisibility ?? "LISTED",
        ...(data.profileVisibility ? { profileVisibility: data.profileVisibility } : {}),
        addressLine1: data.addressLine1?.trim() || null,
        addressLine2: data.addressLine2?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        zip: data.zip?.trim() || null,
        avatarImageId: data.avatarImageId ?? null,
        handleRecord: { create: { handle } },
      },
      select: publicPageFields,
    });

    // Auto-grant the creator ADMIN, then follow the page they just made.
    await grantPermission(userId, page.id, ResourceType.PAGE, PermissionRole.ADMIN, tx);
    await upsertFollow({ type: "USER", id: userId }, { type: "PAGE", id: page.id }, tx);

    return page;
  });
}

/** Drop conversations that lost their last participant. `conversationIds` were captured before the cascade. */
export async function deleteConversationsIfEmpty(conversationIds: string[], tx: Prisma.TransactionClient) {
	if (conversationIds.length === 0) return;
	const remaining = await tx.conversationParticipant.groupBy({
		by: ["conversationId"],
		where: { conversationId: { in: conversationIds } },
		_count: { _all: true },
	});
	const stillHave = new Set(remaining.map((row) => row.conversationId));
	const empty = conversationIds.filter((id) => !stillHave.has(id));
	if (empty.length > 0) await tx.conversation.deleteMany({ where: { id: { in: empty } } });
}

/**
 * Delete a page and return storage paths to remove after commit.
 * Tombstones page-voiced messages and comments before the delete, because the
 * comment FK would otherwise null `asPageId` and leave the human author visible.
 */
export async function deletePage(pageId: string, tx: Prisma.TransactionClient): Promise<string[]> {
	await lockPageAdminChanges(pageId, tx);
	const page = await tx.page.findUnique({ where: { id: pageId }, select: { id: true, avatarImageId: true } });
	if (!page) return [];

	const [posts, events, participations] = await Promise.all([
		tx.post.findMany({ where: { pageId }, select: { id: true } }),
		tx.event.findMany({ where: { pageId }, select: { id: true } }),
		tx.conversationParticipant.findMany({ where: { pageId }, select: { conversationId: true } }),
	]);

	const paths = await detachAllForTargets(
		[
			{ type: AttachmentTarget.PAGE, targetId: pageId },
			...posts.map((post) => ({ type: AttachmentTarget.POST, targetId: post.id })),
			...events.map((event) => ({ type: AttachmentTarget.EVENT, targetId: event.id })),
		],
		tx,
	);

	await tx.message.updateMany({
		where: { asPageId: pageId },
		data: { content: "", deletedAs: "PAGE", senderId: null },
	});
	await tx.comment.updateMany({
		where: { asPageId: pageId },
		data: { content: "", deletedAs: "PAGE", authorId: null },
	});

	await revokeAllForResource(pageId, tx);
	await tx.page.delete({ where: { id: pageId } });

	if (page.avatarImageId) paths.push(...await collectOrphanedImages([page.avatarImageId], tx));
	await deleteConversationsIfEmpty(participations.map((row) => row.conversationId), tx);
	return paths;
}
