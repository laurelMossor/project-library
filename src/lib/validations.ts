import { ProfileData } from "./types/user";
import type { EventCreateInput, EventUpdateInput } from "./types/event";
import type { PostCreateInput, PostUpdateInput } from "./types/post";
import type { RsvpCreateInput } from "./types/rsvp";

// Validation utilities for user input
// Provides reusable validation functions for email, username, password, and profile data

export function validateEmail(email: string): boolean {
	if (!email || typeof email !== "string") return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateUsername(username: string): boolean {
	if (!username || typeof username !== "string") return false;
	// Username: alphanumeric, underscore, hyphen, 3-20 characters
	return /^[a-zA-Z0-9_-]+$/.test(username) && username.length >= 3 && username.length <= 20;
}

export function validatePassword(password: string): boolean {
	if (!password || typeof password !== "string") return false;
	// Minimum 8 characters
	return password.length >= 8;
}

export function validateProfileData(data: ProfileData): { valid: boolean; error?: string } {
	// All fields are optional, but if provided, validate their format

	if (data.firstName !== undefined && data.firstName !== null) {
		if (typeof data.firstName !== "string") {
			return { valid: false, error: "First name must be a string" };
		}
		if (data.firstName.length > 50) {
			return { valid: false, error: "First name must be 50 characters or less" };
		}
	}

	if (data.middleName !== undefined && data.middleName !== null) {
		if (typeof data.middleName !== "string") {
			return { valid: false, error: "Middle name must be a string" };
		}
		if (data.middleName.length > 50) {
			return { valid: false, error: "Middle name must be 50 characters or less" };
		}
	}

	if (data.lastName !== undefined && data.lastName !== null) {
		if (typeof data.lastName !== "string") {
			return { valid: false, error: "Last name must be a string" };
		}
		if (data.lastName.length > 50) {
			return { valid: false, error: "Last name must be 50 characters or less" };
		}
	}

	if (data.headline !== undefined && data.headline !== null) {
		if (typeof data.headline !== "string") {
			return { valid: false, error: "Headline must be a string" };
		}
		if (data.headline.length > 200) {
			return { valid: false, error: "Headline must be 200 characters or less" };
		}
	}

	if (data.bio !== undefined && data.bio !== null) {
		if (typeof data.bio !== "string") {
			return { valid: false, error: "Bio must be a string" };
		}
		if (data.bio.length > 2000) {
			return { valid: false, error: "Bio must be 2000 characters or less" };
		}
	}

	if (data.interests !== undefined && data.interests !== null) {
		if (!Array.isArray(data.interests)) {
			return { valid: false, error: "Interests must be an array" };
		}
		// Validate each interest is a non-empty string
		for (const interest of data.interests) {
			if (typeof interest !== "string" || interest.trim().length === 0) {
				return { valid: false, error: "Each interest must be a non-empty string" };
			}
			if (interest.length > 50) {
				return { valid: false, error: "Each interest must be 50 characters or less" };
			}
		}
	}

	if (data.location !== undefined && data.location !== null) {
		if (typeof data.location !== "string") {
			return { valid: false, error: "Location must be a string" };
		}
		if (data.location.length > 100) {
			return { valid: false, error: "Location must be 100 characters or less" };
		}
	}

	// Validate isPublic: optional boolean
	if (data.isPublic !== undefined && data.isPublic !== null) {
		if (typeof data.isPublic !== "boolean") {
			return { valid: false, error: "isPublic must be a boolean" };
		}
	}

	return { valid: true };
}

function isValidFutureDate(value: Date | undefined | null): boolean {
	if (!value) return false;
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) return false;
	return value.getTime() > Date.now();
}

export function validateEventData(data: EventCreateInput): { valid: boolean; error?: string } {
	if (!data.title || typeof data.title !== "string") {
		return { valid: false, error: "Event title is required" };
	}
	if (data.title.trim().length === 0) {
		return { valid: false, error: "Event title cannot be empty" };
	}
	if (data.title.length > 150) {
		return { valid: false, error: "Event title must be 150 characters or less" };
	}

	if (!data.content || typeof data.content !== "string") {
		return { valid: false, error: "Event content is required" };
	}
	if (data.content.trim().length === 0) {
		return { valid: false, error: "Event content cannot be empty" };
	}
	if (data.content.length > 5000) {
		return { valid: false, error: "Event content must be 5000 characters or less" };
	}

	if (!isValidFutureDate(data.eventDateTime)) {
		return { valid: false, error: "Event date must be in the future" };
	}

	if (data.location != null && typeof data.location === "string" && data.location.length > 255) {
		return { valid: false, error: "Event location must be 255 characters or less" };
	}

	if (data.tags) {
		if (!Array.isArray(data.tags)) {
			return { valid: false, error: "Event tags must be an array" };
		}
		if (data.tags.length > 10) {
			return { valid: false, error: "Maximum 10 tags allowed" };
		}
		for (const tag of data.tags) {
			if (typeof tag !== "string") {
				return { valid: false, error: "Each tag must be a string" };
			}
			const trimmedTag = tag.trim();
			if (trimmedTag.length === 0) {
				return { valid: false, error: "Event tags cannot be empty" };
			}
			if (trimmedTag.length > 50) {
				return { valid: false, error: "Each event tag must be 50 characters or less" };
			}
		}
	}

	if (data.latitude !== undefined && data.latitude !== null) {
		if (typeof data.latitude !== "number" || Number.isNaN(data.latitude)) {
			return { valid: false, error: "Latitude must be a number" };
		}
	}

	if (data.longitude !== undefined && data.longitude !== null) {
		if (typeof data.longitude !== "number" || Number.isNaN(data.longitude)) {
			return { valid: false, error: "Longitude must be a number" };
		}
	}

	return { valid: true };
}

export function validateEventUpdateData(data: EventUpdateInput): { valid: boolean; error?: string } {
	if (data.title !== undefined) {
		if (typeof data.title !== "string" || data.title.length === 0) {
			return { valid: false, error: "Event title must be a non-empty string" };
		}
		if (data.title.length > 150) {
			return { valid: false, error: "Event title must be 150 characters or less" };
		}
	}

	if (data.content !== undefined) {
		if (typeof data.content !== "string" || data.content.trim().length === 0) {
			return { valid: false, error: "Event content must be a non-empty string" };
		}
		if (data.content.length > 5000) {
			return { valid: false, error: "Event content must be 5000 characters or less" };
		}
	}

	if (data.eventDateTime !== undefined && !isValidFutureDate(data.eventDateTime)) {
		return { valid: false, error: "Event date must be in the future" };
	}

	if (data.location !== undefined) {
		if (typeof data.location !== "string" || data.location.trim().length === 0) {
			return { valid: false, error: "Event location must be a non-empty string" };
		}
		if (data.location.length > 255) {
			return { valid: false, error: "Event location must be 255 characters or less" };
		}
	}

	if (data.tags !== undefined) {
		if (!Array.isArray(data.tags)) {
			return { valid: false, error: "Event tags must be an array" };
		}
		if (data.tags.length > 10) {
			return { valid: false, error: "Maximum 10 tags allowed" };
		}
		for (const tag of data.tags) {
			if (typeof tag !== "string") {
				return { valid: false, error: "Each tag must be a string" };
			}
			const trimmedTag = tag.trim();
			if (trimmedTag.length === 0) {
				return { valid: false, error: "Event tags cannot be empty" };
			}
			if (trimmedTag.length > 50) {
				return { valid: false, error: "Each event tag must be 50 characters or less" };
			}
		}
	}

	if (data.latitude !== undefined) {
		if (data.latitude !== null && (typeof data.latitude !== "number" || Number.isNaN(data.latitude))) {
			return { valid: false, error: "Latitude must be a number or null" };
		}
	}

	if (data.longitude !== undefined) {
		if (data.longitude !== null && (typeof data.longitude !== "number" || Number.isNaN(data.longitude))) {
			return { valid: false, error: "Longitude must be a number or null" };
		}
	}

	if (data.status !== undefined) {
		if (data.status !== "DRAFT" && data.status !== "PUBLISHED") {
			return { valid: false, error: "Status must be DRAFT or PUBLISHED" };
		}
	}

	return { valid: true };
}

// RSVP validation utilities

const VALID_RSVP_STATUSES = ["GOING", "MAYBE", "CANT_MAKE_IT"] as const;

export function validateRsvpData(data: RsvpCreateInput): { valid: boolean; error?: string } {
	if (!data.name || typeof data.name !== "string") {
		return { valid: false, error: "Name is required" };
	}
	if (data.name.trim().length === 0) {
		return { valid: false, error: "Name cannot be empty" };
	}
	if (data.name.length > 100) {
		return { valid: false, error: "Name must be 100 characters or less" };
	}

	if (!data.email || typeof data.email !== "string") {
		return { valid: false, error: "Email is required" };
	}
	if (!validateEmail(data.email)) {
		return { valid: false, error: "Invalid email address" };
	}

	if (!data.status || !VALID_RSVP_STATUSES.includes(data.status as typeof VALID_RSVP_STATUSES[number])) {
		return { valid: false, error: "Status must be GOING, MAYBE, or CANT_MAKE_IT" };
	}

	return { valid: true };
}

// Post validation utilities
// Reuses the same tag validation pattern as events

export function validatePostData(data: PostCreateInput): { valid: boolean; error?: string } {
	if (!data.content || typeof data.content !== "string") {
		return { valid: false, error: "Post content is required" };
	}
	if (data.content.trim().length === 0) {
		return { valid: false, error: "Post content cannot be empty" };
	}
	if (data.content.length > 10000) {
		return { valid: false, error: "Post content must be 10,000 characters or less" };
	}

	if (data.title !== undefined && data.title !== null) {
		if (typeof data.title !== "string") {
			return { valid: false, error: "Post title must be a string" };
		}
		if (data.title.length > 150) {
			return { valid: false, error: "Post title must be 150 characters or less" };
		}
	}

	if (data.tags) {
		if (!Array.isArray(data.tags)) {
			return { valid: false, error: "Post tags must be an array" };
		}
		if (data.tags.length > 10) {
			return { valid: false, error: "Maximum 10 tags allowed" };
		}
		for (const tag of data.tags) {
			if (typeof tag !== "string") {
				return { valid: false, error: "Each tag must be a string" };
			}
			const trimmedTag = tag.trim();
			if (trimmedTag.length === 0) {
				return { valid: false, error: "Post tags cannot be empty" };
			}
			if (trimmedTag.length > 50) {
				return { valid: false, error: "Each post tag must be 50 characters or less" };
			}
		}
	}

	return { valid: true };
}

export function validatePostUpdateData(data: PostUpdateInput): { valid: boolean; error?: string } {
	if (data.content !== undefined) {
		if (typeof data.content !== "string" || data.content.trim().length === 0) {
			return { valid: false, error: "Post content must be a non-empty string" };
		}
		if (data.content.length > 10000) {
			return { valid: false, error: "Post content must be 10,000 characters or less" };
		}
	}

	if (data.title !== undefined && data.title !== null) {
		if (typeof data.title !== "string") {
			return { valid: false, error: "Post title must be a string" };
		}
		if (data.title.length > 150) {
			return { valid: false, error: "Post title must be 150 characters or less" };
		}
	}

	if (data.tags !== undefined) {
		if (!Array.isArray(data.tags)) {
			return { valid: false, error: "Post tags must be an array" };
		}
		if (data.tags.length > 10) {
			return { valid: false, error: "Maximum 10 tags allowed" };
		}
		for (const tag of data.tags) {
			if (typeof tag !== "string") {
				return { valid: false, error: "Each tag must be a string" };
			}
			const trimmedTag = tag.trim();
			if (trimmedTag.length === 0) {
				return { valid: false, error: "Post tags cannot be empty" };
			}
			if (trimmedTag.length > 50) {
				return { valid: false, error: "Each post tag must be 50 characters or less" };
			}
		}
	}

	return { valid: true };
}

// Message validation utilities

// Validate message content: required, non-empty, max 5000 characters
export function validateMessageContent(content: string): { valid: boolean; error?: string } {
	if (!content || typeof content !== "string") {
		return { valid: false, error: "Message content is required" };
	}
	if (content.trim().length === 0) {
		return { valid: false, error: "Message content cannot be empty" };
	}
	if (content.length > 5000) {
		return { valid: false, error: "Message content must be 5000 characters or less" };
	}
	return { valid: true };
}

// Page validation utilities

export interface PageCreateData {
	name: string;
	slug: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
}

export function validatePageData(data: PageCreateData): { valid: boolean; error?: string } {
	// Validate name: required, 1-100 characters
	if (!data.name || typeof data.name !== "string") {
		return { valid: false, error: "Page name is required" };
	}
	if (data.name.trim().length === 0) {
		return { valid: false, error: "Page name cannot be empty" };
	}
	if (data.name.length > 100) {
		return { valid: false, error: "Page name must be 100 characters or less" };
	}

	// Validate slug: required, 3-50 characters, alphanumeric and hyphens only
	if (!data.slug || typeof data.slug !== "string") {
		return { valid: false, error: "URL slug is required" };
	}
	if (data.slug.trim().length === 0) {
		return { valid: false, error: "URL slug cannot be empty" };
	}
	if (data.slug.length < 3) {
		return { valid: false, error: "URL slug must be at least 3 characters" };
	}
	if (data.slug.length > 50) {
		return { valid: false, error: "URL slug must be 50 characters or less" };
	}
	if (!/^[a-z0-9-]+$/.test(data.slug)) {
		return { valid: false, error: "URL slug can only contain lowercase letters, numbers, and hyphens" };
	}
	if (data.slug.startsWith("-") || data.slug.endsWith("-")) {
		return { valid: false, error: "URL slug cannot start or end with a hyphen" };
	}

	// Validate headline: optional, max 200 characters
	if (data.headline !== undefined && data.headline !== null) {
		if (typeof data.headline !== "string") {
			return { valid: false, error: "Headline must be a string" };
		}
		if (data.headline.length > 200) {
			return { valid: false, error: "Headline must be 200 characters or less" };
		}
	}

	// Validate bio: optional, max 2000 characters
	if (data.bio !== undefined && data.bio !== null) {
		if (typeof data.bio !== "string") {
			return { valid: false, error: "Bio must be a string" };
		}
		if (data.bio.length > 2000) {
			return { valid: false, error: "Bio must be 2000 characters or less" };
		}
	}

	// Validate interests: optional array, each interest 1-50 chars, max 10 interests
	if (data.interests !== undefined && data.interests !== null) {
		if (!Array.isArray(data.interests)) {
			return { valid: false, error: "Interests must be an array" };
		}
		if (data.interests.length > 10) {
			return { valid: false, error: "Maximum 10 interests allowed" };
		}
		for (const interest of data.interests) {
			if (typeof interest !== "string") {
				return { valid: false, error: "Each interest must be a string" };
			}
			const trimmedInterest = interest.trim();
			if (trimmedInterest.length === 0) {
				return { valid: false, error: "Interests cannot be empty" };
			}
			if (trimmedInterest.length > 50) {
				return { valid: false, error: "Each interest must be 50 characters or less" };
			}
		}
	}

	// Validate location: optional, max 100 characters
	if (data.location !== undefined && data.location !== null) {
		if (typeof data.location !== "string") {
			return { valid: false, error: "Location must be a string" };
		}
		if (data.location.length > 100) {
			return { valid: false, error: "Location must be 100 characters or less" };
		}
	}

	return { valid: true };
}

// Page update validation (for updating existing pages - excludes name and slug which cannot be changed)
export function validatePageUpdateData(data: {
	headline?: string | null;
	bio?: string | null;
	interests?: string[];
	location?: string | null;
	addressLine1?: string | null;
	addressLine2?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	parentTopic?: string | null;
	avatarImageId?: string | null;
	isOpenToCollaborators?: boolean;
}): { valid: boolean; error?: string } {
	// Validate headline: optional, max 200 characters
	if (data.headline !== undefined && data.headline !== null) {
		if (typeof data.headline !== "string") {
			return { valid: false, error: "Headline must be a string" };
		}
		if (data.headline.length > 200) {
			return { valid: false, error: "Headline must be 200 characters or less" };
		}
	}

	// Validate bio: optional, max 2000 characters
	if (data.bio !== undefined && data.bio !== null) {
		if (typeof data.bio !== "string") {
			return { valid: false, error: "Bio must be a string" };
		}
		if (data.bio.length > 2000) {
			return { valid: false, error: "Bio must be 2000 characters or less" };
		}
	}

	// Validate interests: optional array, each interest 1-50 chars, max 10 interests
	if (data.interests !== undefined && data.interests !== null) {
		if (!Array.isArray(data.interests)) {
			return { valid: false, error: "Interests must be an array" };
		}
		if (data.interests.length > 10) {
			return { valid: false, error: "Maximum 10 interests allowed" };
		}
		for (const interest of data.interests) {
			if (typeof interest !== "string") {
				return { valid: false, error: "Each interest must be a string" };
			}
			const trimmedInterest = interest.trim();
			if (trimmedInterest.length === 0) {
				return { valid: false, error: "Interests cannot be empty" };
			}
			if (trimmedInterest.length > 50) {
				return { valid: false, error: "Each interest must be 50 characters or less" };
			}
		}
	}

	// Validate location: optional, max 100 characters
	if (data.location !== undefined && data.location !== null) {
		if (typeof data.location !== "string") {
			return { valid: false, error: "Location must be a string" };
		}
		if (data.location.length > 100) {
			return { valid: false, error: "Location must be 100 characters or less" };
		}
	}

	// Validate address fields: optional, max 200 characters each
	if (data.addressLine1 !== undefined && data.addressLine1 !== null) {
		if (typeof data.addressLine1 !== "string") {
			return { valid: false, error: "Address line 1 must be a string" };
		}
		if (data.addressLine1.length > 200) {
			return { valid: false, error: "Address line 1 must be 200 characters or less" };
		}
	}

	if (data.addressLine2 !== undefined && data.addressLine2 !== null) {
		if (typeof data.addressLine2 !== "string") {
			return { valid: false, error: "Address line 2 must be a string" };
		}
		if (data.addressLine2.length > 200) {
			return { valid: false, error: "Address line 2 must be 200 characters or less" };
		}
	}

	if (data.city !== undefined && data.city !== null) {
		if (typeof data.city !== "string") {
			return { valid: false, error: "City must be a string" };
		}
		if (data.city.length > 100) {
			return { valid: false, error: "City must be 100 characters or less" };
		}
	}

	if (data.state !== undefined && data.state !== null) {
		if (typeof data.state !== "string") {
			return { valid: false, error: "State must be a string" };
		}
		if (data.state.length > 100) {
			return { valid: false, error: "State must be 100 characters or less" };
		}
	}

	if (data.zip !== undefined && data.zip !== null) {
		if (typeof data.zip !== "string") {
			return { valid: false, error: "ZIP code must be a string" };
		}
		if (data.zip.length > 20) {
			return { valid: false, error: "ZIP code must be 20 characters or less" };
		}
	}

	// Validate parent topic: optional, max 100 characters
	if (data.parentTopic !== undefined && data.parentTopic !== null) {
		if (typeof data.parentTopic !== "string") {
			return { valid: false, error: "Parent topic must be a string" };
		}
		if (data.parentTopic.length > 100) {
			return { valid: false, error: "Parent topic must be 100 characters or less" };
		}
	}

	// Validate isOpenToCollaborators: optional boolean
	if (data.isOpenToCollaborators !== undefined && data.isOpenToCollaborators !== null) {
		if (typeof data.isOpenToCollaborators !== "boolean") {
			return { valid: false, error: "isOpenToCollaborators must be a boolean" };
		}
	}

	// avatarImageId validation - just check it's a string if provided
	if (data.avatarImageId !== undefined && data.avatarImageId !== null) {
		if (typeof data.avatarImageId !== "string") {
			return { valid: false, error: "Avatar image ID must be a string" };
		}
	}

	return { valid: true };
}
