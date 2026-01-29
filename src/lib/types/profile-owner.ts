/**
 * ProfileOwner - Unified type for components that work with both Users and Orgs
 * This represents the display/profile side of ownership (User profile or Org profile)
 */
import { PublicUser, getUserDisplayName } from "./user";
import { PublicOrg } from "./org";

// Unified ProfileOwner type for components that work with both Users and Orgs
export type ProfileOwner = 
	| { type: "USER"; data: PublicUser }
	| { type: "ORG"; data: PublicOrg };

// Helper to get display name from profile owner
// For users: uses getUserDisplayName utility (displayName > firstName + lastName > username)
export function getProfileOwnerDisplayName(owner: ProfileOwner): string {
	if (owner.type === "USER") {
		return getUserDisplayName(owner.data);
	}
	return owner.data.name;
}

// Helper to get identifier (username or slug) from profile owner
export function getProfileOwnerIdentifier(owner: ProfileOwner): string {
	if (owner.type === "USER") {
		return owner.data.username;
	}
	return owner.data.slug;
}

// Helper to get headline from profile owner
export function getProfileOwnerHeadline(owner: ProfileOwner): string | null {
	return owner.data.headline;
}

// Helper to get bio from profile owner
export function getProfileOwnerBio(owner: ProfileOwner): string | null {
	return owner.data.bio;
}

// Helper to get interests from profile owner
export function getProfileOwnerInterests(owner: ProfileOwner): string[] {
	return owner.data.interests || [];
}

// Helper to get location from profile owner
export function getProfileOwnerLocation(owner: ProfileOwner): string | null {
	return owner.data.location;
}

// Helper to get avatar image ID from profile owner
export function getProfileOwnerAvatarImageId(owner: ProfileOwner): string | null {
	return owner.data.avatarImageId;
}

// Helper to get owner ID from profile owner
export function getProfileOwnerOwnerId(owner: ProfileOwner): string {
	return owner.data.ownerId;
}
