import { PublicUser, getUserDisplayName } from "./user";
import { PublicOrg } from "./org";

// Unified Actor type for components that work with both Users and Orgs
export type Actor = 
	| { type: "USER"; data: PublicUser }
	| { type: "ORG"; data: PublicOrg };

// Helper to get display name from actor
// For users: uses getUserDisplayName utility (displayName > firstName + lastName > username)
export function getActorDisplayName(actor: Actor): string {
	if (actor.type === "USER") {
		return getUserDisplayName(actor.data);
	}
	return actor.data.name;
}

// Helper to get identifier (username or slug) from actor
export function getActorIdentifier(actor: Actor): string {
	if (actor.type === "USER") {
		return actor.data.username;
	}
	return actor.data.slug;
}

// Helper to get headline from actor
export function getActorHeadline(actor: Actor): string | null {
	return actor.data.headline;
}

// Helper to get bio from actor
export function getActorBio(actor: Actor): string | null {
	return actor.data.bio;
}

// Helper to get interests from actor
export function getActorInterests(actor: Actor): string[] {
	return actor.data.interests || [];
}

// Helper to get location from actor
export function getActorLocation(actor: Actor): string | null {
	return actor.data.location;
}

// Helper to get avatar image ID from actor
export function getActorAvatarImageId(actor: Actor): string | null {
	return actor.data.avatarImageId;
}

