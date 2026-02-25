/**
 * Minimal types for card/list item displays
 * These are the essential fields needed to render cards in lists and grids
 */

import { getUserDisplayName } from "./user";
import type { PublicOwner } from "../utils/owner";
import type { ImageItem } from "./image";

// ============================================================================
// Connection Types (for ManageConnections)
// ============================================================================

export type ConnectionType = "admins" | "followers" | "following" | "members";

// ============================================================================
// User & Org Card Types
// ============================================================================

// Minimal user data for card displays
export type CardUser = {
	id: string;
	username: string;
	displayName: string | null;
	firstName: string | null;
	lastName: string | null;
	avatarImageId: string | null;
};

// Minimal org data for card displays
export type CardOrg = {
	id: string;
	name: string;
	slug: string;
	avatarImageId: string | null;
};

// ============================================================================
// Project & Event Card Types (for CollectionCard)
// ============================================================================

// Base fields shared by all collection card types
type CardCollectionBase = {
	id: string;
	title: string;
	description: string;
	tags: string[];
	topics: string[];
	owner: PublicOwner;
	createdAt: Date | string;
	images: ImageItem[];
};

// Minimal project data for card displays
export type CardProject = CardCollectionBase & {
	type: "project";
};

// Minimal event data for card displays
export type CardEvent = CardCollectionBase & {
	type: "event";
	eventDateTime: Date | string;
	location: string;
};

// Union type for collection cards
export type CardCollectionItem = CardProject | CardEvent;

// Type guard for card event
export function isCardEvent(item: CardCollectionItem): item is CardEvent {
	return item.type === "event";
}

// Type guard for card project
export function isCardProject(item: CardCollectionItem): item is CardProject {
	return item.type === "project";
}

// ============================================================================
// Helper Functions
// ============================================================================

// Get display name for a card user
export function getCardUserDisplayName(user: CardUser): string {
	return getUserDisplayName({
		displayName: user.displayName,
		firstName: user.firstName,
		lastName: user.lastName,
		username: user.username,
	});
}

// Get display name for a card org
export function getCardOrgDisplayName(org: CardOrg): string {
	return org.name;
}

// Get initials for a card user
export function getCardUserInitials(user: CardUser): string {
	if (user.firstName && user.lastName) {
		return (user.firstName[0] + user.lastName[0]).toUpperCase();
	}
	if (user.firstName) {
		return user.firstName[0].toUpperCase();
	}
	if (user.lastName) {
		return user.lastName[0].toUpperCase();
	}
	return user.username[0].toUpperCase();
}

// Get initials for a card org
export function getCardOrgInitials(orgName: string): string {
	const words = orgName.trim().split(/\s+/);
	if (words.length >= 2) {
		return (words[0][0] + words[1][0]).toUpperCase();
	}
	const name = words[0];
	if (name.length >= 3) {
		return name.substring(0, 3).toUpperCase();
	}
	return name.substring(0, 2).toUpperCase();
}
