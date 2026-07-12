/**
 * Minimal types for card/list item displays
 * These are the essential fields needed to render cards in lists and grids
 */

import { getUserDisplayName } from "./user";
import { getUserInitials, getPageInitials } from "@/lib/utils/text";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import type { ImageItem } from "./image";

// ============================================================================
// User & Page Card Types
// ============================================================================

// Minimal user data for card displays
export type CardUser = {
	id: string;
	handle: string;
	displayName: string | null;
	avatarImageId: string | null;
	avatarImage?: { url: string } | null;
};

// Minimal page data for card displays
export type CardPage = {
	id: string;
	name: string;
	handle: string;
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

// A CardUser or CardPage — pages have `name`, users have `displayName`
export type CardEntity = CardUser | CardPage;

// CardPage with the user's role on that page (ADMIN | EDITOR | MEMBER)
// TODO consider just expanding cardpage to have role, and/or make ROLES an enum
export type CardPageWithRole = CardPage & { role: string };

export function isCardPage(entity: CardEntity): entity is CardPage {
	return "name" in entity;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Get display name for a card user
export function getCardUserDisplayName(user: CardUser): string {
	return getUserDisplayName(user);
}

// Get display name for a card page
export function getCardPageDisplayName(page: CardPage): string {
	return page.name;
}

// Delegate to shared initials utilities in utils/text.ts
export const getCardUserInitials = (user: CardUser): string => getUserInitials(user);
export const getCardPageInitials = (pageName: string): string => getPageInitials(pageName);

/** The display fields resolved from a User-or-Page card entity. */
export type ResolvedIdentity = {
	name: string;
	handle: string;
	/** Profile URL for this identity. */
	href: string;
	initials: string;
};

/**
 * Resolve a User-or-Page into its display fields in one place — name, @handle, profile href,
 * and initials — so cards, lists, and comment rows stop re-deriving the user-vs-page branch.
 */
export function resolveCardIdentity(entity: CardEntity): ResolvedIdentity {
	const page = isCardPage(entity);
	return {
		name: page ? entity.name : getCardUserDisplayName(entity),
		handle: entity.handle,
		href: PUBLIC_PROFILE(entity.handle),
		initials: page ? getPageInitials(entity.name) : getUserInitials(entity),
	};
}
