// ⚠️ SERVER-ONLY: Session utility functions
// Do not import this in client components! Only use in API routes, server components, or "use server" functions.

import { auth } from "@/lib/auth";
import { prisma } from "./prisma";
import { getOwnerById, getPersonalOwner, ownerBelongsToUser, ownerIsActive } from "./owner";
import type { OwnerWithRelations } from "./owner";
import { OwnerType } from "@prisma/client";

// ========================
// Types
// ========================

export type SessionContext = {
	userId: string;
	activeOwnerId: string;
	activeOwner: OwnerWithRelations;
};

// ========================
// Session helpers
// ========================

/**
 * Get the current authenticated user's ID from session
 * Returns null if not authenticated
 */
export async function getSessionUserId(): Promise<string | null> {
	const session = await auth();
	return session?.user?.id ?? null;
}

/**
 * Get the active owner ID from session
 * Falls back to the user's personal owner if not set
 */
export async function getActiveOwnerId(userId: string): Promise<string | null> {
	const session = await auth();
	
	// If session has activeOwnerId, verify it belongs to user and is active
	if (session?.user?.activeOwnerId) {
		const validOwner = await ownerBelongsToUser(session.user.activeOwnerId, userId);
		if (validOwner) {
			const active = await ownerIsActive(session.user.activeOwnerId);
			if (active) {
				return session.user.activeOwnerId;
			}
		}
	}
	
	// Fall back to personal owner
	const personalOwner = await getPersonalOwner(userId);
	return personalOwner?.id ?? null;
}

/**
 * Get full session context with active owner
 * Returns null if not authenticated or owner cannot be determined
 */
export async function getSessionContext(): Promise<SessionContext | null> {
	const session = await auth();
	if (!session?.user?.id) return null;

	const userId = session.user.id;
	const activeOwnerId = await getActiveOwnerId(userId);
	if (!activeOwnerId) return null;

	const activeOwner = await getOwnerById(activeOwnerId, true, true);
	if (!activeOwner) return null;

	return {
		userId,
		activeOwnerId,
		activeOwner,
	};
}

/**
 * Validate that a user can set a specific owner as active
 * Checks ownership and for org-based owners, checks membership status
 */
export async function canSetActiveOwner(userId: string, ownerId: string): Promise<boolean> {
	const owner = await getOwnerById(ownerId);
	if (!owner) return false;
	
	// Must belong to user
	if (owner.userId !== userId) return false;
	
	// Must be active
	if (owner.status !== "ACTIVE") return false;
	
	// For org-based owners, verify membership exists
	if (owner.type === OwnerType.ORG && owner.orgId) {
		const membership = await prisma.orgMember.findUnique({
			where: { ownerId: owner.id },
		});
		if (!membership) return false;
	}
	
	return true;
}

/**
 * Check if the active owner is acting on behalf of an org
 */
export function isActingAsOrg(owner: OwnerWithRelations): boolean {
	return owner.type === OwnerType.ORG && owner.orgId !== null;
}

// ========================
// Profile Edit Permissions
// ========================

export type ProfileEditCheck = {
	canEdit: boolean;
	reason?: "not_authenticated" | "acting_as_org" | "not_owner" | "not_org_member";
	activeOrgSlug?: string;
};

/**
 * Check if the current session can edit a user profile
 * Returns canEdit: false with reason if acting as org (should redirect to org profile)
 */
export async function canEditUserProfile(userId: string): Promise<ProfileEditCheck> {
	const context = await getSessionContext();
	
	if (!context) {
		return { canEdit: false, reason: "not_authenticated" };
	}
	
	// Check if user owns this profile
	if (context.userId !== userId) {
		return { canEdit: false, reason: "not_owner" };
	}
	
	// Check if acting as org - if so, they should edit org profile instead
	if (isActingAsOrg(context.activeOwner)) {
		const orgSlug = context.activeOwner.org?.slug;
		return { 
			canEdit: false, 
			reason: "acting_as_org",
			activeOrgSlug: orgSlug || undefined,
		};
	}
	
	return { canEdit: true };
}

/**
 * Check if the current session can edit an org profile
 * Returns canEdit: true if user is a member of the org and acting as that org
 */
export async function canEditOrgProfile(orgId: string): Promise<ProfileEditCheck> {
	const context = await getSessionContext();
	
	if (!context) {
		return { canEdit: false, reason: "not_authenticated" };
	}
	
	// Check if acting as this specific org
	if (!isActingAsOrg(context.activeOwner) || context.activeOwner.orgId !== orgId) {
		return { canEdit: false, reason: "not_org_member" };
	}
	
	return { canEdit: true };
}
