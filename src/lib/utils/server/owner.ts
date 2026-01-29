// ⚠️ SERVER-ONLY: Owner utility functions
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { prisma } from "./prisma";
import { OwnerType, OwnerStatus, OrgRole } from "@prisma/client";

// ========================
// Types
// ========================

export type OwnerWithRelations = {
	id: string;
	userId: string;
	orgId: string | null;
	type: OwnerType;
	status: OwnerStatus;
	createdAt: Date;
	user?: {
		id: string;
		username: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		avatarImageId: string | null;
	};
	org?: {
		id: string;
		slug: string;
		name: string;
		avatarImageId: string | null;
	} | null;
};

export type PublicOwner = {
	id: string;
	type: OwnerType;
	userId: string;
	orgId: string | null;
	status: OwnerStatus;
	user?: {
		id: string;
		username: string;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
	};
	org?: {
		id: string;
		slug: string;
		name: string;
	} | null;
};

// ========================
// Query functions
// ========================

/**
 * Get an owner by ID with optional includes
 */
export async function getOwnerById(
	ownerId: string,
	includeUser = false,
	includeOrg = false
): Promise<OwnerWithRelations | null> {
	return prisma.owner.findUnique({
		where: { id: ownerId },
		include: {
			user: includeUser
				? {
						select: {
							id: true,
							username: true,
							displayName: true,
							firstName: true,
							lastName: true,
							avatarImageId: true,
						},
				  }
				: false,
			org: includeOrg
				? {
						select: {
							id: true,
							slug: true,
							name: true,
							avatarImageId: true,
						},
				  }
				: false,
		},
	});
}

/**
 * Get all owners for a user
 */
export async function getOwnersForUser(userId: string): Promise<OwnerWithRelations[]> {
	return prisma.owner.findMany({
		where: { userId },
		include: {
			org: {
				select: {
					id: true,
					slug: true,
					name: true,
					avatarImageId: true,
				},
			},
		},
		orderBy: [{ type: "asc" }, { createdAt: "asc" }], // USER type first, then by creation
	});
}

/**
 * Get a user's personal owner (type = USER, orgId = null)
 */
export async function getPersonalOwner(userId: string): Promise<OwnerWithRelations | null> {
	return prisma.owner.findFirst({
		where: {
			userId,
			orgId: null,
			type: OwnerType.USER,
		},
	});
}

/**
 * Get or create a personal owner for a user
 */
export async function getOrCreatePersonalOwner(userId: string): Promise<OwnerWithRelations> {
	const existing = await getPersonalOwner(userId);
	if (existing) return existing;

	return prisma.owner.create({
		data: {
			userId,
			orgId: null,
			type: OwnerType.USER,
			status: OwnerStatus.ACTIVE,
		},
	});
}

/**
 * Get or create an org-based owner for a user
 */
export async function getOrCreateOrgOwner(
	userId: string,
	orgId: string
): Promise<OwnerWithRelations> {
	const existing = await prisma.owner.findFirst({
		where: { userId, orgId },
	});
	if (existing) return existing;

	return prisma.owner.create({
		data: {
			userId,
			orgId,
			type: OwnerType.ORG,
			status: OwnerStatus.ACTIVE,
		},
		include: {
			org: {
				select: {
					id: true,
					slug: true,
					name: true,
					avatarImageId: true,
				},
			},
		},
	});
}

/**
 * Check if an owner belongs to a user
 */
export async function ownerBelongsToUser(ownerId: string, userId: string): Promise<boolean> {
	const owner = await prisma.owner.findFirst({
		where: { id: ownerId, userId },
	});
	return owner !== null;
}

/**
 * Check if owner can act (is active)
 */
export async function ownerIsActive(ownerId: string): Promise<boolean> {
	const owner = await prisma.owner.findFirst({
		where: { id: ownerId, status: OwnerStatus.ACTIVE },
	});
	return owner !== null;
}

/**
 * Get user's role in an org via their org-based owner
 */
export async function getOwnerOrgRole(ownerId: string): Promise<OrgRole | null> {
	const membership = await prisma.orgMember.findUnique({
		where: { ownerId },
		select: { role: true },
	});
	return membership?.role ?? null;
}

/**
 * Get the active owner ID for a user (personal owner if no org selected)
 * This is typically their personal owner ID unless they've selected an org
 */
export async function getOwnerIdForUser(userId: string, activeOwnerId?: string | null): Promise<string | null> {
	// If user has an active owner set, verify it belongs to them
	if (activeOwnerId) {
		const isValid = await ownerBelongsToUser(activeOwnerId, userId);
		if (isValid) return activeOwnerId;
	}
	
	// Fall back to personal owner
	const personalOwner = await getPersonalOwner(userId);
	return personalOwner?.id ?? null;
}

/**
 * Check if an owner owns a specific project
 */
export async function ownerOwnsProject(ownerId: string, projectId: string): Promise<boolean> {
	const project = await prisma.project.findFirst({
		where: { id: projectId, ownerId },
		select: { id: true },
	});
	return project !== null;
}

/**
 * Check if an owner owns a specific event
 */
export async function ownerOwnsEvent(ownerId: string, eventId: string): Promise<boolean> {
	const event = await prisma.event.findFirst({
		where: { id: eventId, ownerId },
		select: { id: true },
	});
	return event !== null;
}
