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

export interface ProfileData {
	name?: string;
	headline?: string;
	bio?: string;
	interests?: string[];
	location?: string;
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

