// ⚠️ SERVER-ONLY: This file uses prisma (database client)
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { AttachmentTarget } from "@prisma/client";
import { prisma } from "./prisma";
import { profileElementFields } from "./profile-element";
import { getSoleAdminPages, getSuccessorAdminIds, lockPageAdminChanges } from "./permission";
// page.ts and image-attachment.ts reach back here through fields.ts → publicUserEmbedFields.
// Import them inside deleteAccount so this module can finish loading first.

/** The pages the confirm modal listed no longer match what deletion would remove. */
export class AccountDeleteConflict extends Error {
	constructor() {
		super("The pages that would be deleted have changed. Review the list and try again.");
		this.name = "AccountDeleteConflict";
	}
}

function sameIdSet(a: string[], b: string[]) {
	if (a.length !== b.length) return false;
	const left = [...a].sort();
	const right = [...b].sort();
	return left.every((id, i) => id === right[i]);
}

// Standard fields to select when fetching a user profile
export const personalProfileFields = {
	id: true,
	handle: true,
	email: true,
	firstName: true,
	middleName: true,
	lastName: true,
	displayName: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
	profileVisibility: true,
	contentVisibility: true,
	aboutContent: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
	elements: { select: profileElementFields, where: { visible: true }, orderBy: { sortOrder: "asc" as const } },
} as const;

// Public fields (excludes sensitive data like email, but includes ID for messaging)
export const publicUserFields = {
	id: true,
	handle: true,
	firstName: true,
	middleName: true,
	lastName: true,
	displayName: true,
	headline: true,
	bio: true,
	interests: true,
	location: true,
	profileVisibility: true,
	contentVisibility: true,
	aboutContent: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
	elements: { select: profileElementFields, where: { visible: true }, orderBy: { sortOrder: "asc" as const } },
} as const;

// Attribution-only fields for embedding a user on OTHER content (post/event author,
// message participant). Deliberately excludes sensitive profile fields
// (bio/location/interests/aboutContent/email) so a PRIVATE user's details never ride
// along on their public content. The full profile is fetched only by the gated profile
// page via publicUserFields. Enforced by the embed-selector test guard.
export const publicUserEmbedFields = {
	id: true,
	handle: true,
	firstName: true,
	lastName: true,
	displayName: true,
	avatarImageId: true,
	avatarImage: { select: { url: true } },
} as const;

// Fetch a user by ID (for authenticated user's own profile)
export async function getUserById(id: string) {
	return prisma.user.findUnique({
		where: { id },
		select: personalProfileFields,
	});
}

// Fetch a user by handle (formerly username; field renamed in PR 2).
// Uses findFirst with mode: 'insensitive' so lookups are case-insensitive,
// though stored handles are always lowercase per the PR 2 normalization rule
// (so the case-insensitive match is mostly belt-and-suspenders).
export async function getUserByHandle(handle: string) {
	return prisma.user.findFirst({
		where: { handle: { equals: handle, mode: "insensitive" } },
		select: publicUserFields,
	});
}

// Update a user's profile data
export async function updateUserProfile(
	userId: string,
	data: {
		firstName?: string;
		middleName?: string;
		lastName?: string;
		displayName?: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		profileVisibility?: import("@prisma/client").ProfileVisibility;
		contentVisibility?: import("@prisma/client").ContentVisibility;
		avatarImageId?: string | null;
		aboutContent?: string | null;
	},
	tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
	// Build update data object with only explicitly provided fields
	// This prevents accidentally overwriting fields with undefined
	const updateData: {
		firstName?: string;
		middleName?: string;
		lastName?: string;
		displayName?: string;
		headline?: string;
		bio?: string;
		interests?: string[];
		location?: string;
		profileVisibility?: import("@prisma/client").ProfileVisibility;
		contentVisibility?: import("@prisma/client").ContentVisibility;
		avatarImageId?: string | null;
		aboutContent?: string | null;
	} = {};

	if (data.firstName !== undefined) updateData.firstName = data.firstName;
	if (data.middleName !== undefined) updateData.middleName = data.middleName;
	if (data.lastName !== undefined) updateData.lastName = data.lastName;
	if (data.displayName !== undefined) updateData.displayName = data.displayName;
	if (data.headline !== undefined) updateData.headline = data.headline;
	if (data.bio !== undefined) updateData.bio = data.bio;
	if (data.interests !== undefined) updateData.interests = data.interests;
	if (data.location !== undefined) updateData.location = data.location;
	if (data.profileVisibility !== undefined) updateData.profileVisibility = data.profileVisibility;
	if (data.contentVisibility !== undefined) updateData.contentVisibility = data.contentVisibility;
	if (data.avatarImageId !== undefined) updateData.avatarImageId = data.avatarImageId;
	if (data.aboutContent !== undefined) updateData.aboutContent = data.aboutContent;

	return ((tx ?? prisma) as typeof prisma).user.update({
		where: { id: userId },
		data: updateData,
		select: personalProfileFields,
	});
}

/**
 * Create a new user (with companion Handle row).
 *
 * User IDs are auto-generated by Prisma via `@default(cuid())` in schema.prisma.
 * The Handle row is created atomically via Prisma's nested-write syntax —
 * single SQL transaction at the driver layer, satisfying PR 2's invariant
 * that User and Handle either both exist or neither does.
 *
 * The handle is lowercased here (the canonical storage form — INV-7), so callers
 * cannot accidentally persist mixed case. Caller is still responsible for:
 *   - Running `validateHandle` + `isReservedHandle` + `isHandleTaken` first.
 *
 * If a concurrent registration claims the handle between the pre-check and
 * this insert, the unique constraint on `handles.handle` will throw a
 * Prisma `P2002` error which the caller surfaces as "handle already taken."
 */
export async function createUser(data: {
	email: string;
	handle: string;
	passwordHash: string;
	firstName?: string;
	middleName?: string;
	lastName?: string;
	displayName?: string;
	/** Pre-verify the account (used by the dev-signup-bypass path + seed). */
	emailVerified?: Date;
	/** Mark the settings review done. E2E accounts pass this; dev-bypass signups leave it unset. */
	setupCompletedAt?: Date;
}): Promise<{ userId: string }> {
	const names = [data.firstName, data.lastName].filter(Boolean).join(" ");
	const displayName = data.displayName ?? (names || null);
	// Handles are always stored lowercase (INV-7) — canonicalize here, not at the caller.
	const handle = data.handle.toLowerCase();

	const user = await prisma.user.create({
		data: {
			email: data.email,
			handle,
			passwordHash: data.passwordHash,
			firstName: data.firstName ?? null,
			middleName: data.middleName ?? null,
			lastName: data.lastName ?? null,
			displayName,
			emailVerified: data.emailVerified ?? null,
			setupCompletedAt: data.setupCompletedAt ?? null,
			// New accounts default to open distribution; explicit since the column no longer
			// carries a DB default (a forgotten derivation must fail at compile time, not fall to LISTED).
			contentVisibility: "LISTED",
			handleRecord: { create: { handle } },
		},
		select: { id: true },
	});
	return { userId: user.id };
}

/**
 * Delete an account and return storage paths to remove after commit.
 * `expectedPageIds` is the sole-admin list the modal showed; a mismatch throws
 * AccountDeleteConflict so the caller can refetch instead of deleting more than it listed.
 */
export async function deleteAccount(userId: string, expectedPageIds: string[]): Promise<string[]> {
	const { deleteConversationsIfEmpty, deletePage } = await import("./page");
	const { collectOrphanedImages, detachAllForTargets } = await import("./image-attachment");
	return prisma.$transaction(async (tx) => {
		// Blocks a new page or post by this user until the transaction ends. Their
		// foreign keys need a share lock on this row.
		await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;

		const initialSole = await getSoleAdminPages(userId, tx);
		const [created, voicedPosts, voicedEvents] = await Promise.all([
			tx.page.findMany({ where: { createdByUserId: userId }, select: { id: true } }),
			tx.post.findMany({ where: { userId, asPageId: { not: null } }, select: { asPageId: true } }),
			tx.event.findMany({ where: { userId, asPageId: { not: null } }, select: { asPageId: true } }),
		]);
		const createdIds = new Set(created.map((page) => page.id));
		const voicedIds = new Set<string>([
			...voicedPosts.map((post) => post.asPageId!),
			...voicedEvents.map((event) => event.asPageId!),
		]);
		const candidateIds = [...new Set([
			...initialSole.map((page) => page.id),
			...createdIds,
			...voicedIds,
		])];
		for (const pageId of candidateIds) await lockPageAdminChanges(pageId, tx);

		const soleIds = (await getSoleAdminPages(userId, tx)).map((page) => page.id);
		if (!sameIdSet(soleIds, expectedPageIds)) throw new AccountDeleteConflict();

		const paths: string[] = [];
		const deleted = new Set<string>();
		for (const pageId of soleIds) {
			paths.push(...await deletePage(pageId, tx));
			deleted.add(pageId);
		}

		const related = new Set<string>([...createdIds, ...voicedIds]);
		for (const pageId of deleted) related.delete(pageId);

		const successors = await getSuccessorAdminIds([...related], userId, tx);
		const reassigned = new Set<string>();
		for (const pageId of related) {
			const successor = successors.get(pageId);
			const ownsPage = createdIds.has(pageId);
			if (!successor) {
				// A created page with nobody to hand it to would cascade away without
				// tombstones. The retry lists it, because it is now a sole-admin page.
				// A page this user only spoke as stays; their posts cascade with the user.
				if (ownsPage) throw new AccountDeleteConflict();
				continue;
			}
			if (ownsPage) {
				await tx.page.updateMany({
					where: { id: pageId, createdByUserId: userId },
					data: { createdByUserId: successor },
				});
				reassigned.add(pageId);
			}
			await tx.post.updateMany({ where: { userId, asPageId: pageId }, data: { userId: successor } });
			await tx.event.updateMany({ where: { userId, asPageId: pageId }, data: { userId: successor } });
			// Images the surviving page still uses need an uploader, or deleting this user
			// nulls uploadedByUserId (onDelete: SetNull) and the avatar can be collected as an orphan.
			const [keptPosts, keptEvents, page] = await Promise.all([
				tx.post.findMany({ where: { asPageId: pageId, userId: successor }, select: { id: true } }),
				tx.event.findMany({ where: { asPageId: pageId, userId: successor }, select: { id: true } }),
				tx.page.findUnique({ where: { id: pageId }, select: { avatarImageId: true } }),
			]);
			const attachmentOr = [
				...(keptPosts.length > 0
					? [{ type: AttachmentTarget.POST, targetId: { in: keptPosts.map((post) => post.id) } }]
					: []),
				...(keptEvents.length > 0
					? [{ type: AttachmentTarget.EVENT, targetId: { in: keptEvents.map((event) => event.id) } }]
					: []),
			];
			const attachments = attachmentOr.length > 0
				? await tx.imageAttachment.findMany({ where: { OR: attachmentOr }, select: { imageId: true } })
				: [];
			const imageIds = [
				...attachments.map((row) => row.imageId),
				...(page?.avatarImageId ? [page.avatarImageId] : []),
			];
			if (imageIds.length > 0) {
				await tx.image.updateMany({
					where: { id: { in: imageIds }, uploadedByUserId: userId },
					data: { uploadedByUserId: successor },
				});
			}
		}

		const stillOwned = await tx.page.findMany({
			where: { createdByUserId: userId },
			select: { id: true },
		});
		if (stillOwned.some((page) => !deleted.has(page.id) && !reassigned.has(page.id))) {
			throw new AccountDeleteConflict();
		}

		await tx.message.updateMany({
			where: { senderId: userId, asPageId: null },
			data: { content: "", deletedAs: "USER", senderId: null },
		});
		await tx.comment.updateMany({
			where: { authorId: userId, asPageId: null },
			data: { content: "", deletedAs: "USER", authorId: null },
		});

		const rsvps = await tx.rsvp.findMany({ where: { userId }, select: { id: true } });
		for (const rsvp of rsvps) {
			await tx.rsvp.update({
				where: { id: rsvp.id },
				data: { name: "[user deleted]", email: `deleted-${rsvp.id}@deleted.invalid`, userId: null },
			});
			await tx.rsvpGuest.updateMany({ where: { rsvpId: rsvp.id }, data: { name: null } });
		}

		const [doomedPosts, doomedEvents, images, participations] = await Promise.all([
			tx.post.findMany({ where: { userId }, select: { id: true } }),
			tx.event.findMany({ where: { userId }, select: { id: true } }),
			tx.image.findMany({ where: { uploadedByUserId: userId }, select: { id: true } }),
			tx.conversationParticipant.findMany({ where: { userId }, select: { conversationId: true } }),
		]);
		paths.push(...await detachAllForTargets([
			...doomedPosts.map((post) => ({ type: AttachmentTarget.POST, targetId: post.id })),
			...doomedEvents.map((event) => ({ type: AttachmentTarget.EVENT, targetId: event.id })),
		], tx));

		await tx.emailOutbox.deleteMany({ where: { recipientUserId: userId } });
		await tx.user.delete({ where: { id: userId } });
		paths.push(...await collectOrphanedImages(images.map((image) => image.id), tx));
		await deleteConversationsIfEmpty(participations.map((row) => row.conversationId), tx);
		return paths;
	}, { timeout: 30_000, maxWait: 10_000 });
}

