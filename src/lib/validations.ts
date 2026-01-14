import { ProfileData } from "./types/user";
import { ProjectData, ProjectUpdateInput } from "./types/project";
import type { EventCreateInput, EventUpdateInput } from "./types/event";

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

	return { valid: true };
}

// Project validation utilities


export function validateProjectData(data: ProjectData): { valid: boolean; error?: string } {
	// Validate title: required, 1-200 characters
	if (!data.title || typeof data.title !== "string") {
		return { valid: false, error: "Title is required" };
	}
	if (data.title.trim().length === 0) {
		return { valid: false, error: "Title cannot be empty" };
	}
	if (data.title.length > 200) {
		return { valid: false, error: "Title must be 200 characters or less" };
	}

	// Validate description: required, 1-5000 characters
	if (!data.description || typeof data.description !== "string") {
		return { valid: false, error: "Description is required" };
	}
	if (data.description.trim().length === 0) {
		return { valid: false, error: "Description cannot be empty" };
	}
	if (data.description.length > 5000) {
		return { valid: false, error: "Description must be 5000 characters or less" };
	}

	// Validate tags: optional array, each tag 1-50 chars, max 10 tags
	if (data.tags !== undefined && data.tags !== null) {
		if (!Array.isArray(data.tags)) {
			return { valid: false, error: "Tags must be an array" };
		}
		if (data.tags.length > 10) {
			return { valid: false, error: "Maximum 10 tags allowed" };
		}
		// Validate each tag is a non-empty string, 1-50 characters
		for (const tag of data.tags) {
			if (typeof tag !== "string") {
				return { valid: false, error: "Each tag must be a string" };
			}
			const trimmedTag = tag.trim();
			if (trimmedTag.length === 0) {
				return { valid: false, error: "Tags cannot be empty" };
			}
			if (trimmedTag.length > 50) {
				return { valid: false, error: "Each tag must be 50 characters or less" };
			}
		}
	}

	// Note: Images should be uploaded separately and linked to the project after creation

	return { valid: true };
}

export function validateProjectUpdateData(data: ProjectUpdateInput): { valid: boolean; error?: string } {
	if (data.title !== undefined) {
		if (typeof data.title !== "string" || data.title.trim().length === 0) {
			return { valid: false, error: "Title must be a non-empty string" };
		}
		if (data.title.length > 200) {
			return { valid: false, error: "Title must be 200 characters or less" };
		}
	}

	if (data.description !== undefined) {
		if (typeof data.description !== "string" || data.description.trim().length === 0) {
			return { valid: false, error: "Description must be a non-empty string" };
		}
		if (data.description.length > 5000) {
			return { valid: false, error: "Description must be 5000 characters or less" };
		}
	}

	if (data.tags !== undefined) {
		if (!Array.isArray(data.tags)) {
			return { valid: false, error: "Tags must be an array" };
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
				return { valid: false, error: "Tags cannot be empty" };
			}
			if (trimmedTag.length > 50) {
				return { valid: false, error: "Each tag must be 50 characters or less" };
			}
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

	if (!data.description || typeof data.description !== "string") {
		return { valid: false, error: "Event description is required" };
	}
	if (data.description.trim().length === 0) {
		return { valid: false, error: "Event description cannot be empty" };
	}
	if (data.description.length > 5000) {
		return { valid: false, error: "Event description must be 5000 characters or less" };
	}

	if (!isValidFutureDate(data.dateTime)) {
		return { valid: false, error: "Event date must be in the future" };
	}

	if (!data.location || typeof data.location !== "string") {
		return { valid: false, error: "Event location is required" };
	}
	if (data.location.trim().length === 0) {
		return { valid: false, error: "Event location cannot be empty" };
	}
	if (data.location.length > 255) {
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

	if (data.description !== undefined) {
		if (typeof data.description !== "string" || data.description.trim().length === 0) {
			return { valid: false, error: "Event description must be a non-empty string" };
		}
		if (data.description.length > 5000) {
			return { valid: false, error: "Event description must be 5000 characters or less" };
		}
	}

	if (data.dateTime !== undefined && !isValidFutureDate(data.dateTime)) {
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

// Org validation utilities

export interface OrgCreateData {
	name: string;
	slug: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
}

export function validateOrgData(data: OrgCreateData): { valid: boolean; error?: string } {
	// Validate name: required, 1-100 characters
	if (!data.name || typeof data.name !== "string") {
		return { valid: false, error: "Organization name is required" };
	}
	if (data.name.trim().length === 0) {
		return { valid: false, error: "Organization name cannot be empty" };
	}
	if (data.name.length > 100) {
		return { valid: false, error: "Organization name must be 100 characters or less" };
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

