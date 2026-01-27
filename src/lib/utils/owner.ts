/**
 * Client-side utilities for working with Owner data from API responses
 * Owner represents the attribution identity (personal or org-based)
 */

import type { OwnerType } from "@prisma/client";
import { PublicUser, getUserDisplayName } from "../types/user";

/**
 * Org info as included in owner responses
 */
export type PublicOrg = {
	id: string;
	name: string;
	slug: string;
	headline: string | null;
	bio: string | null;
	interests: string[];
	location: string | null;
	avatarImageId: string | null;
};

/**
 * Owner shape as returned from API responses (with user/org context)
 * This matches the `projectWithOwnerFields.owner` / `eventWithOwnerFields.owner` select shape
 */
export type PublicOwner = {
	id: string;
	type: OwnerType;
	user: PublicUser | null;
	org: PublicOrg | null;
};

/**
 * Get the owner's id
 */
export function getOwnerId(owner: PublicOwner): string {
	return owner.id;
}

/**
 * Check if owner is a user type
 */
export function isUserOwner(owner: PublicOwner): boolean {
	return owner.type === "USER";
}

/**
 * Check if owner is an org type
 */
export function isOrgOwner(owner: PublicOwner): boolean {
	return owner.type === "ORG";
}

/**
 * Get the user from the owner (if it's a USER type owner)
 */
export function getOwnerUser(owner: PublicOwner): PublicUser | null {
	if (isUserOwner(owner) && owner.user) {
		return owner.user;
	}
	return null;
}

/**
 * Get the org from the owner (if it's an ORG type owner)
 */
export function getOwnerOrg(owner: PublicOwner): PublicOrg | null {
	if (isOrgOwner(owner) && owner.org) {
		return owner.org;
	}
	return null;
}

/**
 * Get display name for owner (user or org)
 * For users: uses getUserDisplayName utility (displayName > firstName + lastName > username)
 * For orgs: returns org name
 */
export function getOwnerDisplayName(owner: PublicOwner): string {
	if (isUserOwner(owner) && owner.user) {
		return getUserDisplayName(owner.user);
	}
	if (isOrgOwner(owner) && owner.org) {
		return owner.org.name;
	}
	return "Unknown";
}

/**
 * Get username/slug for owner (for building profile links)
 */
export function getOwnerHandle(owner: PublicOwner): string | null {
	if (isUserOwner(owner) && owner.user) {
		return owner.user.username;
	}
	if (isOrgOwner(owner) && owner.org) {
		return owner.org.slug;
	}
	return null;
}

/**
 * Get the underlying entity's id (userId for USER owners, orgId for ORG owners)
 * Use this when you specifically need the user or org id, not the owner id
 */
export function getOwnerEntityId(owner: PublicOwner): string | null {
	if (isUserOwner(owner) && owner.user) {
		return owner.user.id;
	}
	if (isOrgOwner(owner) && owner.org) {
		return owner.org.id;
	}
	return null;
}
