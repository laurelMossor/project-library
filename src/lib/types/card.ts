/**
 * Minimal types for card/list item displays
 * These are the essential fields needed to render cards in lists and grids
 */

import { getUserDisplayName } from "./user";
import type { ImageItem } from "./image";

// ============================================================================
// Connection Types (for ManageConnections)
// ============================================================================

export type ConnectionType = "admins" | "followers" | "following" | "members";

// ============================================================================
// User & Page Card Types
// ============================================================================

// Minimal user data for card displays
export type CardUser = {
	id: string;
	username: string;
	displayName: string | null;
	firstName: string | null;
	lastName: string | null;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
};

// Minimal page data for card displays
export type CardPage = {
	id: string;
	name: string;
	slug: string;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
};

// ============================================================================
// Event Card Types (for CollectionCard)
// ============================================================================

// Base fields shared by all collection card types
type CardCollectionBase = {
	id: string;
	title: string;
	description: string;
	tags: string[];
	topics: string[];
	user: CardUser;
	page: CardPage | null;
	createdAt: Date | string;
	images: ImageItem[];
};

// Minimal event data for card displays
export type CardEvent = CardCollectionBase & {
	type: "event";
	eventDateTime: Date | string;
	location: string;
};

// Minimal post data for card displays
export type CardPost = CardCollectionBase & {
	type: "post";
	content: string;
	eventId: string | null;
	parentPostId: string | null;
};

// Union type for collection cards
export type CardCollectionItem = CardEvent | CardPost;

// Type guard for card event
export function isCardEvent(item: CardCollectionItem): item is CardEvent {
	return item.type === "event";
}

// Type guard for card post
export function isCardPost(item: CardCollectionItem): item is CardPost {
	return item.type === "post";
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

// Get display name for a card page
export function getCardPageDisplayName(page: CardPage): string {
	return page.name;
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

// Get initials for a card page
export function getCardPageInitials(pageName: string): string {
	const words = pageName.trim().split(/\s+/);
	if (words.length >= 2) {
		return (words[0][0] + words[1][0]).toUpperCase();
	}
	const name = words[0];
	if (name.length >= 3) {
		return name.substring(0, 3).toUpperCase();
	}
	return name.substring(0, 2).toUpperCase();
}
