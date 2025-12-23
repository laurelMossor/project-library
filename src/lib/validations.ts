import { ProfileData } from "./types/user";
import { ProjectData } from "./types/project";

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
	
	if (data.name !== undefined && data.name !== null) {
		if (typeof data.name !== "string") {
			return { valid: false, error: "Name must be a string" };
		}
		if (data.name.length > 100) {
			return { valid: false, error: "Name must be 100 characters or less" };
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

	// Validate imageUrl: optional string, must be valid URL or path format
	if (data.imageUrl !== undefined && data.imageUrl !== null) {
		if (typeof data.imageUrl !== "string") {
			return { valid: false, error: "Image URL must be a string" };
		}
		if (data.imageUrl.trim().length === 0) {
			return { valid: false, error: "Image URL cannot be empty" };
		}
		// Basic validation: should start with / or http:// or https://
		if (!/^(\/|https?:\/\/)/.test(data.imageUrl)) {
			return { valid: false, error: "Invalid image URL format" };
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

