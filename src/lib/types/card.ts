/**
 * Minimal types for card/list item displays
 * These are the essential fields needed to render cards in lists and grids
 */

import { getUserDisplayName } from "./user";
import { getUserInitials, getPageInitials } from "@/lib/utils/text";
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
	title: string | null;
	content: string;
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
// Entity Union
// ============================================================================

// A CardUser or CardPage — pages have `slug`, users have `username`
export type CardEntity = CardUser | CardPage;

// TODO mourn whatever logic created this monstrosity and fix it
export function isCardPage(entity: CardEntity): entity is CardPage {
	return "slug" in entity;
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

// Delegate to shared initials utilities in utils/text.ts
export const getCardUserInitials = (user: CardUser): string => getUserInitials(user);
export const getCardPageInitials = (pageName: string): string => getPageInitials(pageName);
