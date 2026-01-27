/**
 * Utilities for working with Owner-based ownership
 * In v0.3, Owner represents user identity or org membership
 */

import { PublicUser, getUserDisplayName } from "../types/user";

/**
 * Owner structure from API responses
 * Note: Matches projectWithOwnerFields/eventWithOwnerFields shape
 */
export type OwnerView = {
	id: string;
	type: "USER" | "ORG";
	user: PublicUser | null;
	org: {
		id: string;
		name: string;
		slug: string;
		headline: string | null;
		bio: string | null;
		interests: string[];
		location: string | null;
		avatarImageId: string | null;
	} | null;
};

// Alias for backward compatibility
export type ActorOwner = OwnerView;

/**
 * Extract PublicUser from Owner
 * Returns the user if owner type is USER, null otherwise
 */
export function getOwnerUser(owner: OwnerView): PublicUser | null {
	if (owner.type === "USER" && owner.user) {
		return owner.user;
	}
	return null;
}

/**
 * Get display name for owner (user or org)
 * For users: uses getUserDisplayName utility (displayName > firstName + lastName > username)
 */
export function getOwnerDisplayName(owner: OwnerView): string {
	if (owner.type === "USER" && owner.user) {
		return getUserDisplayName(owner.user);
	}
	if (owner.type === "ORG" && owner.org) {
		return owner.org.name;
	}
	return "Unknown";
}

/**
 * Get username/slug for owner (for links)
 */
export function getOwnerUsername(owner: OwnerView): string | null {
	if (owner.type === "USER" && owner.user) {
		return owner.user.username;
	}
	if (owner.type === "ORG" && owner.org) {
		return owner.org.slug;
	}
	return null;
}

/**
 * Get owner ID (user id or org id)
 */
export function getOwnerId(owner: OwnerView): string | null {
	if (owner.type === "USER" && owner.user) {
		return owner.user.id;
	}
	if (owner.type === "ORG" && owner.org) {
		return owner.org.id;
	}
	return null;
}

