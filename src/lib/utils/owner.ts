/**
 * Utilities for working with Actor-based ownership
 * In v2, owners are Actors which can be Users or Orgs
 */

import { PublicUser } from "../types/user";

/**
 * Owner structure from database (Actor with user/org)
 */
export type ActorOwner = {
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

/**
 * Extract PublicUser from Actor owner structure
 * Returns the user if owner is a USER actor, null otherwise
 */
export function getOwnerUser(owner: ActorOwner): PublicUser | null {
	if (owner.type === "USER" && owner.user) {
		return owner.user;
	}
	return null;
}

/**
 * Get display name for owner (user or org)
 */
export function getOwnerDisplayName(owner: ActorOwner): string {
	if (owner.type === "USER" && owner.user) {
		const nameParts = [owner.user.firstName, owner.user.middleName, owner.user.lastName].filter(Boolean);
		return nameParts.length > 0 ? nameParts.join(' ') : owner.user.username;
	}
	if (owner.type === "ORG" && owner.org) {
		return owner.org.name;
	}
	return "Unknown";
}

/**
 * Get username/slug for owner (for links)
 */
export function getOwnerUsername(owner: ActorOwner): string | null {
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
export function getOwnerId(owner: ActorOwner): string | null {
	if (owner.type === "USER" && owner.user) {
		return owner.user.id;
	}
	if (owner.type === "ORG" && owner.org) {
		return owner.org.id;
	}
	return null;
}

